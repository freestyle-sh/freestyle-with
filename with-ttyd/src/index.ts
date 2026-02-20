import { VmSpec, VmWith, VmWithInstance } from "freestyle-sandboxes";
import type { VmPtySessionLike } from "@freestyle-sh/with-pty";
import type { Freestyle } from "freestyle-sandboxes";

// ============================================================================
// Configuration Types
// ============================================================================

export type TtydConfig = {
  /** Port to run ttyd on (default: auto-assigned starting at 7682) */
  port?: number;
  /** Shell or command to run (default: /bin/bash) */
  command?: string;
  /** Attach ttyd to a PTY session */
  pty?: VmPtySessionLike;
  /** User to run terminal as (default: current user) */
  user?: string;
  /** Working directory (default: user home) */
  cwd?: string;
  /** Enable basic auth */
  credential?: { username: string; password: string };
  /** Terminal title shown in browser tab */
  title?: string;
  /** Read-only terminal (no input allowed) */
  readOnly?: boolean;
};

export type ResolvedTerminalConfig = {
  port: number;
  command: string;
  user: string;
  cwd: string;
  credential?: { username: string; password: string };
  title: string;
  readOnly: boolean;
};

// ============================================================================
// Builder Class
// ============================================================================

export class VmWebTerminal<
  T extends TtydConfig[] = TtydConfig[],
> extends VmWith<VmWebTerminalInstance<T>> {
  private resolvedTerminals: ResolvedTerminalConfig[];
  private ptySessions: VmPtySessionLike[];

  constructor(terminals: T | TtydConfig) {
    super();
    const terminalList = Array.isArray(terminals) ? terminals : [terminals];
    this.ptySessions = terminalList
      .map((config) => config.pty)
      .filter((value): value is VmPtySessionLike => value !== undefined);
    // Resolve config once with defaults
    let nextPort = 7682;
    this.resolvedTerminals = terminalList.map((config) => {
      if (config.pty && config.command) {
        throw new Error(
          "VmWebTerminal config cannot include both pty and command. Use one or the other.",
        );
      }

      const port = config.port ?? nextPort++;
      const resolvedCommand = config.pty
        ? config.pty.attachCommand(config.readOnly ?? false)
        : (config.command ?? "bash -l");

      return {
        port,
        command: resolvedCommand,
        user: config.user ?? "root",
        cwd: config.cwd ?? "/root",
        credential: config.credential,
        title: config.title ?? `terminal-${port}`,
        readOnly: config.readOnly ?? false,
      };
    });
  }

  private composeTtydSpec(spec: VmSpec): VmSpec {
    const uniquePtySessions = Array.from(new Set(this.ptySessions));
    let composed = spec;

    for (const pty of uniquePtySessions) {
      composed = pty.applyToSpec(composed) as VmSpec;
    }

    // Generate install script
    const installScript = `#!/bin/bash
  set -e

  TTYD_VERSION="1.7.7"
  mkdir -p /usr/local/bin
  tmpfile="$(mktemp)"
  curl -fsSL -o "$tmpfile" "https://github.com/tsl0922/ttyd/releases/download/\${TTYD_VERSION}/ttyd.x86_64"
  mv "$tmpfile" /usr/local/bin/ttyd
  chmod +x /usr/local/bin/ttyd
  /usr/local/bin/ttyd --version
  `;

    // Generate systemd service for each terminal
    const services = this.resolvedTerminals.map((t) => {
      const args: string[] = [`/usr/local/bin/ttyd`, `-p ${t.port}`];

      if (t.credential) {
        if (
          t.credential.username.length === 0 ||
          t.credential.password.length === 0
        ) {
          throw new Error(
            `Invalid credential for terminal on port ${t.port}: username and password cannot be empty`,
          );
        }
        if (
          t.credential.username.includes(":") ||
          t.credential.password.includes(":")
        ) {
          throw new Error(
            `Invalid credential for terminal on port ${t.port}: username and password cannot contain colon (:) character`,
          );
        }
        args.push(
          `--credential ${t.credential.username}:${t.credential.password}`,
        );
      }
      if (t.readOnly) {
        args.push(`--readonly`);
      } else {
        args.push(`--writable`);
      }

      // Shell command at the end
      args.push(t.command);

      return {
        name: `web-terminal-${t.port}`,
        mode: "service" as const,
        exec: [args.join(" ")],
        user: t.user,
        cwd: t.cwd,
        restart: "always" as const,
        restartSec: 2,
        after: ["install-ttyd.service", "systemd-sysusers.service"],
        requires: ["systemd-sysusers.service"],
      };
    });

    return this.composeSpecs(
      composed,
      new VmSpec({
        additionalFiles: {
          "/opt/install-ttyd.sh": { content: installScript },
        },
        systemd: {
          services: [
            {
              name: "install-ttyd",
              mode: "oneshot",
              deleteAfterSuccess: true,
              exec: ["bash /opt/install-ttyd.sh"],
              timeoutSec: 120,
            },
            ...services,
          ],
        },
      }),
    );
  }

  override configureSnapshotSpec(spec: VmSpec): VmSpec {
    return this.composeTtydSpec(spec);
  }

  override configureSpec(spec: VmSpec): VmSpec {
    return this.composeTtydSpec(spec);
  }

  createInstance(): VmWebTerminalInstance<T> {
    return new VmWebTerminalInstance(this, this.resolvedTerminals);
  }

  installServiceName(): string {
    return "install-ttyd.service";
  }
}

// ============================================================================
// Instance Class (runtime access)
// ============================================================================

export class WebTerminal {
  readonly port: number;
  readonly command: string;
  private instance: VmWebTerminalInstance<TtydConfig[]>;

  constructor({
    port,
    command,
    instance,
  }: {
    port: number;
    command: string;
    instance: VmWebTerminalInstance<TtydConfig[]>;
  }) {
    this.port = port;
    this.command = command;
    this.instance = instance;
  }

  /** Expose this terminal publicly via Freestyle routing */
  async route({ domain }: { domain: string }): Promise<void> {
    const vm = this.instance._vm;
    // @ts-expect-error using internal thing
    const freestyle: Freestyle = vm._freestyle;
    console.log(
      `Routing terminal on vm ${vm.vmId} at port ${this.port} to domain ${domain}`,
    );
    await freestyle.domains.mappings.create({
      domain: domain,
      vmId: vm.vmId,
      vmPort: this.port,
    });
  }
}

export class VmWebTerminalInstance<
  T extends TtydConfig[],
> extends VmWithInstance {
  builder: VmWebTerminal<T>;
  readonly terminals: WebTerminal[];

  constructor(
    builder: VmWebTerminal<T>,
    resolvedTerminals: ResolvedTerminalConfig[],
  ) {
    super();
    this.builder = builder;
    this.terminals = [];

    // Create terminals in order and expose as an array
    for (const config of resolvedTerminals) {
      const terminal = new WebTerminal({
        port: config.port,
        command: config.command,
        instance: this,
      });
      this.terminals.push(terminal);
    }
  }

  /** @internal */
  get _vm() {
    return this.vm;
  }
}
