import {
  VmTemplate,
  type CreateVmOptions,
  VmWith,
  VmWithInstance,
  Freestyle,
} from "freestyle-sandboxes";

// ============================================================================
// Configuration Types
// ============================================================================

export type TtydConfig = {
  /** Port to run ttyd on (default: auto-assigned starting at 7681) */
  port?: number;
  /** Shell or command to run (default: /bin/bash) */
  shell?: string;
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

export type WebTerminalConfig = { id: string } & TtydConfig;

// ============================================================================
// Builder Class
// ============================================================================

export class VmWebTerminal<
  T extends WebTerminalConfig[] = WebTerminalConfig[]
> extends VmWith<VmWebTerminalInstance<T> & TerminalInstances<T>> {
  private terminals: T;

  constructor(terminals: T) {
    super();
    this.terminals = terminals;
  }

  override configure(
    existingConfig: CreateVmOptions
  ): CreateVmOptions | Promise<CreateVmOptions> {
    // Auto-assign ports starting at 7682
    let nextPort = 7682;
    const resolvedTerminals = this.terminals.map((config) => ({
      id: config.id,
      port: config.port ?? nextPort++,
      shell: config.shell ?? "bash -l",
      user: config.user,
      cwd: config.cwd,
      credential: config.credential,
      title: config.title ?? config.id,
      readOnly: config.readOnly ?? false,
    }));

    // Generate install script
    const installScript = `#!/bin/bash
set -e

TTYD_VERSION="1.7.7"
curl -fsSL -o /usr/local/bin/ttyd "https://github.com/tsl0922/ttyd/releases/download/\${TTYD_VERSION}/ttyd.x86_64"
chmod +x /usr/local/bin/ttyd
/usr/local/bin/ttyd --version
`;

    // Generate systemd service for each terminal
    const services = resolvedTerminals.map((t) => {
      const args: string[] = [
        `/usr/local/bin/ttyd`,
        `-p ${t.port}`,
      ];

      if (t.credential) {
        args.push(`--credential ${t.credential.username}:${t.credential.password}`);
      }
      if (t.readOnly) {
        args.push(`--readonly`);
      } else {
        args.push(`--writable`);
      }

      // Shell command at the end (default: bash -l for login shell)
      args.push(t.shell);

      return {
        name: `web-terminal-${t.id}`,
        mode: "service" as const,
        exec: [args.join(" ")],
        user: t.user ?? "root",
        cwd: t.cwd ?? "/root",
        restart: "always" as const,
        restartSec: 2,
        after: ["install-ttyd.service"],
      };
    });

    const config: CreateVmOptions = {
      template: new VmTemplate({
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
    };

    return this.compose(existingConfig, config);
  }

  createInstance(): VmWebTerminalInstance<T> & TerminalInstances<T> {
    return new VmWebTerminalInstance(this, this.terminals) as VmWebTerminalInstance<T> & TerminalInstances<T>;
  }

  installServiceName(): string {
    return "install-ttyd.service";
  }
}

// ============================================================================
// Instance Class (runtime access)
// ============================================================================

export class WebTerminal {
  readonly id: string;
  readonly port: number;
  readonly shell: string;
  private instance: VmWebTerminalInstance<any>;

  constructor({ id, port, shell, instance }: { id: string; port: number; shell: string; instance: VmWebTerminalInstance<any> }) {
    this.id = id;
    this.port = port;
    this.shell = shell;
    this.instance = instance;
  }

  /** Expose this terminal publicly via Freestyle routing */
  async route({ domain }: { domain: string }): Promise<void> {
    const vm = this.instance._vm;
    // @ts-expect-error using internal thing
    const freestyle: Freestyle = vm._freestyle;
    console.log(`Routing terminal ${this.id} on vm ${vm.vmId} at port ${this.port} to domain ${domain}`);
    await freestyle.domains.mappings.create({
      domain: domain,
      vmId: vm.vmId,
      vmPort: this.port,
    })
  }
}

export type TerminalInstances<T extends WebTerminalConfig[]> = {
  [K in T[number]["id"]]: WebTerminal;
};

export class VmWebTerminalInstance<
  T extends WebTerminalConfig[]
> extends VmWithInstance {
  builder: VmWebTerminal<T>;

  constructor(builder: VmWebTerminal<T>, terminals: T) {
    super();
    this.builder = builder;

    // Create terminals as properties
    let nextPort = 7681;
    for (const config of terminals) {
      const terminal = new WebTerminal({
        id: config.id,
        port: config.port ?? nextPort++,
        shell: config.shell ?? "bash -l",
        instance: this,
      });
      (this as any)[config.id] = terminal;
    }
  }

  /** @internal */
  get _vm() {
    return this.vm;
  }
}
