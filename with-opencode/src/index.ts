import {
  VmSpec,
  type CreateVmOptions,
  VmWith,
  VmWithInstance,
  type Freestyle,
} from "freestyle-sandboxes";
import { createOpencodeClient } from "@opencode-ai/sdk/v2";

export type OpenCodeAuthOptions = {
  password?: string;
  username?: string;
};

export type ResolvedOpenCodeAuthOptions =
  | {
      password: string;
      username: string;
    }
  | {
      password?: undefined;
      username?: undefined;
    };

export type OpenCodeOptions = {
  server?: {
    port?: number;
  } & OpenCodeAuthOptions;
  web?: {
    port?: number;
  } & OpenCodeAuthOptions;
};

export type OpenCodeResolvedOptions = {
  server: {
    port: number;
  } & ResolvedOpenCodeAuthOptions;
  web: {
    port: number;
  } & ResolvedOpenCodeAuthOptions;
};

function resolveAuth(opts?: OpenCodeAuthOptions): ResolvedOpenCodeAuthOptions {
  return opts?.password
    ? { password: opts.password, username: opts.username ?? "opencode" }
    : {};
}

export class VmOpenCode extends VmWith<VmOpenCodeInstance> {
  options: OpenCodeResolvedOptions;

  constructor(options?: OpenCodeOptions) {
    super();
    this.options = {
      server: {
        port: options?.server?.port ?? 4096,
        ...resolveAuth(options?.server),
      },
      web: { port: options?.web?.port ?? 4097, ...resolveAuth(options?.web) },
    };
  }

  override configureSnapshotSpec(spec: VmSpec): VmSpec {
    const webAuthEnv = this.options.web.username
      ? `OPENCODE_SERVER_USERNAME=${this.options.web.username} OPENCODE_SERVER_PASSWORD=${this.options.web.password}`.trim()
      : "";

    const serverAuthEnv = this.options.server.username
      ? `OPENCODE_SERVER_USERNAME=${this.options.server.username} OPENCODE_SERVER_PASSWORD=${this.options.server.password}`.trim()
      : "";

    return this.composeSpecs(
      spec,
      new VmSpec({
        additionalFiles: {
          "/opt/install-opencode.sh": {
            content: `
            #!/bin/bash

            curl -fsSL https://opencode.ai/install | bash
            `,
          },
          "/opt/run-opencode-web.sh": {
            content: `
              #!/bin/bash

              export PATH="$HOME/.local/bin:$PATH"
              ${webAuthEnv} /root/.opencode/bin/opencode web --hostname 0.0.0.0 --port ${this.options.web.port}
              `,
          },
          "/opt/run-opencode-server.sh": {
            content: `
              #!/bin/bash

              export PATH="$HOME/.local/bin:$PATH"
              ${serverAuthEnv} /root/.opencode/bin/opencode serve --hostname 0.0.0.0 --port ${this.options.server.port}
              `,
          },
        },
        systemd: {
          services: [
            {
              name: "install-opencode",
              mode: "oneshot",
              env: {
                HOME: "/root",
              },
              exec: ["bash /opt/install-opencode.sh"],
              timeoutSec: 300,
            },
            {
              name: "opencode-server",
              mode: "service",
              env: {
                HOME: "/root",
              },
              after: ["install-opencode.service"],
              requires: ["install-opencode.service"],
              restartPolicy: {
                policy: "always",
              },
              exec: ["bash /opt/run-opencode-server.sh"],
            },
            {
              name: "opencode-web",
              mode: "service",
              env: {
                HOME: "/root",
              },
              after: ["install-opencode.service"],
              requires: ["install-opencode.service"],
              restartPolicy: {
                policy: "always",
              },
              exec: ["bash /opt/run-opencode-web.sh"],
            },
          ],
        },
      }),
    );
  }

  createInstance(): VmOpenCodeInstance {
    return new VmOpenCodeInstance(this);
  }

  installServiceName(): string {
    return "install-opencode.service";
  }
}

class VmOpenCodeInstance extends VmWithInstance {
  builder: VmOpenCode;

  constructor(builder: VmOpenCode) {
    super();
    this.builder = builder;
  }

  webPort(): number {
    return this.builder.options.web.port;
  }

  serverPort(): number {
    return this.builder.options.server.port;
  }

  async client({ domain }: { domain?: string } = {}) {
    const resolvedDomain =
      domain ?? `${crypto.randomUUID()}-opencode.style.dev`;
    // @ts-expect-error using internal thing
    const freestyle: Freestyle = this._vm._freestyle;
    await freestyle.domains.mappings.create({
      domain: resolvedDomain,
      vmId: this.vm.vmId,
      vmPort: this.serverPort(),
    });

    return {
      client: createOpencodeClient({
        baseUrl: `https://${resolvedDomain}`,
        headers: this.builder.options.server.username
          ? {
              Authorization: `Basic ${btoa(
                `${this.builder.options.server.username}:${this.builder.options.server.password}`,
              )}`,
            }
          : {},
      }),
    };
  }

  async routeWeb({ domain }: { domain?: string } = {}) {
    const resolvedDomain =
      domain ?? `${crypto.randomUUID()}-opencode.style.dev`;
    // @ts-expect-error using internal thing
    const freestyle: Freestyle = this._vm._freestyle;
    await freestyle.domains.mappings.create({
      domain: resolvedDomain,
      vmId: this.vm.vmId,
      vmPort: this.webPort(),
    });
    return {
      url: `https://${resolvedDomain}`,
    };
  }

  /** @internal */
  get _vm() {
    return this.vm;
  }
}
