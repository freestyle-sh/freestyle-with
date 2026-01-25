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
  /** Port to run ttyd on (default: auto-assigned starting at 7682) */
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

export type ResolvedTerminalConfig = {
  id: string;
  port: number;
  shell: string;
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
  T extends WebTerminalConfig[] = WebTerminalConfig[]
> extends VmWith<VmWebTerminalInstance<T> & TerminalInstances<T>> {
  private resolvedTerminals: ResolvedTerminalConfig[];

  constructor(terminals: T) {
    super();
    // Resolve config once with defaults
    let nextPort = 7682;
    this.resolvedTerminals = terminals.map((config) => ({
      id: config.id,
      port: config.port ?? nextPort++,
      shell: config.shell ?? "bash -l",
      user: config.user ?? "root",
      cwd: config.cwd ?? "/root",
      credential: config.credential,
      title: config.title ?? config.id,
      readOnly: config.readOnly ?? false,
    }));
  }

  override configure(
    existingConfig: CreateVmOptions
  ): CreateVmOptions | Promise<CreateVmOptions> {

    // Generate install script
    const installScript = `#!/bin/bash
set -e

TTYD_VERSION="1.7.7"
curl -fsSL -o /usr/local/bin/ttyd "https://github.com/tsl0922/ttyd/releases/download/\${TTYD_VERSION}/ttyd.x86_64"
chmod +x /usr/local/bin/ttyd
/usr/local/bin/ttyd --version
`;

    // Generate systemd service for each terminal
    const services = this.resolvedTerminals.map((t) => {
      const args: string[] = [
        `/usr/local/bin/ttyd`,
        `-p ${t.port}`,
      ];

      if (t.credential) {
        if (t.credential.username.length === 0 || t.credential.password.length === 0) {
          throw new Error(
            `Invalid credential for terminal ${t.id}: username and password cannot be empty`
          );
        }
        if (t.credential.username.includes(":") || t.credential.password.includes(":")) {
          throw new Error(
            `Invalid credential for terminal ${t.id}: username and password cannot contain colon (:) character`
          );
        }
        args.push(`--credential ${t.credential.username}:${t.credential.password}`);
      }
      if (t.readOnly) {
        args.push(`--readonly`);
      } else {
        args.push(`--writable`);
      }

      // Shell command at the end
      args.push(t.shell);

      return {
        name: `web-terminal-${t.id}`,
        mode: "service" as const,
        exec: [args.join(" ")],
        user: t.user,
        cwd: t.cwd,
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
    return new VmWebTerminalInstance(this, this.resolvedTerminals) as VmWebTerminalInstance<T> & TerminalInstances<T>;
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

  constructor(builder: VmWebTerminal<T>, resolvedTerminals: ResolvedTerminalConfig[]) {
    super();
    this.builder = builder;

    // Create terminals as properties using resolved config
    for (const config of resolvedTerminals) {
      const terminal = new WebTerminal({
        id: config.id,
        port: config.port,
        shell: config.shell,
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
