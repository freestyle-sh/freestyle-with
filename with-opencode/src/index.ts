import {
  VmSpec,
  type CreateVmOptions,
  VmWith,
  VmWithInstance,
  type Freestyle,
} from "freestyle-sandboxes";
import { createOpencodeClient } from "@opencode-ai/sdk";

export type OpenCodeOptions = {
  serverPort?: number;
  webPort?: number;
};
export type OpenCodeResolvedOptions = {
  serverPort: number;
  webPort: number;
};

export class VmOpenCode extends VmWith<VmOpenCodeInstance> {
  options: OpenCodeResolvedOptions;

  constructor(options?: OpenCodeOptions) {
    super();
    this.options = {
      serverPort: options?.serverPort ?? 4096,
      webPort: options?.webPort ?? 4097,
    };
  }

  override configureSnapshotSpec(spec: VmSpec): VmSpec {
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
              /root/.opencode/bin/opencode web --hostname 0.0.0.0 --port ${this.options.webPort}
              `,
          },
          "/opt/run-opencode-server.sh": {
            content: `
              #!/bin/bash

              export PATH="$HOME/.local/bin:$PATH"
              /root/.opencode/bin/opencode serve --hostname 0.0.0.0 --port ${this.options.serverPort}
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
    return this.builder.options.webPort;
  }

  serverPort(): number {
    return this.builder.options.serverPort;
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
