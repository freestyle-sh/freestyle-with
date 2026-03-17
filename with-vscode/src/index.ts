import { VmSpec, VmWith, VmWithInstance } from "freestyle-sandboxes";
import type { Freestyle } from "freestyle-sandboxes";

// ============================================================================
// Configuration Types
// ============================================================================

export type VmVscodeOptions = {
  /** Port to run code-server on (default: 8080) */
  port?: number;
  /** Folder to open in VS Code (default: /root) */
  workdir?: string;
  /** User to run code-server as (default: root) */
  user?: string;
  /** VS Code extensions to pre-install (e.g. ["esbenp.prettier-vscode"]) */
  extensions?: string[];
};

export type VmVscodeResolvedOptions = {
  port: number;
  workdir: string;
  user: string;
  extensions: string[];
};

// ============================================================================
// Builder Class
// ============================================================================

const CODE_SERVER_VERSION = "4.100.3";

export class VmVscode extends VmWith<VmVscodeInstance> {
  options: VmVscodeResolvedOptions;

  constructor(options?: VmVscodeOptions) {
    super();
    this.options = {
      port: options?.port ?? 8080,
      workdir: options?.workdir ?? "/root",
      user: options?.user ?? "root",
      extensions: options?.extensions ?? [],
    };
  }

  override configureSnapshotSpec(spec: VmSpec): VmSpec {
    return this.composeCodeServerSpec(spec);
  }

  override configureSpec(spec: VmSpec): VmSpec {
    return this.composeCodeServerSpec(spec);
  }

  private composeCodeServerSpec(spec: VmSpec): VmSpec {
    const { port, workdir, user, extensions } = this.options;

    const installScript = `#!/bin/bash
set -e

CODE_SERVER_VERSION="${CODE_SERVER_VERSION}"
mkdir -p /usr/local/bin /tmp/code-server-install
cd /tmp/code-server-install
curl -fsSL -o code-server.tar.gz "https://github.com/coder/code-server/releases/download/v\${CODE_SERVER_VERSION}/code-server-\${CODE_SERVER_VERSION}-linux-amd64.tar.gz"
tar -xzf code-server.tar.gz
cp code-server-\${CODE_SERVER_VERSION}-linux-amd64/bin/code-server /usr/local/bin/code-server
cp -r code-server-\${CODE_SERVER_VERSION}-linux-amd64/lib /usr/local/lib/code-server
chmod +x /usr/local/bin/code-server
rm -rf /tmp/code-server-install
code-server --version
`;

    const installExtensionsScript =
      extensions.length > 0
        ? `#!/bin/bash
set -e
${extensions.map((ext) => `/usr/local/bin/code-server --install-extension ${ext}`).join("\n")}
`
        : null;

    const configYaml = [
      `bind-addr: 0.0.0.0:${port}`,
      `auth: none`,
      `cert: false`,
      `disable-telemetry: true`,
      `disable-update-check: true`,
    ].join("\n");

    const args: string[] = [
      `/usr/local/bin/code-server`,
      `--config /etc/code-server/config.yaml`,
      workdir,
    ];

    const serviceAfter = installExtensionsScript
      ? [
          "install-code-server.service",
          "install-code-server-extensions.service",
        ]
      : ["install-code-server.service"];

    return this.composeSpecs(
      spec,
      new VmSpec({
        additionalFiles: {
          "/etc/code-server/config.yaml": { content: configYaml },
          "/opt/install-code-server.sh": { content: installScript },
          ...(installExtensionsScript
            ? {
                "/opt/install-code-server-extensions.sh": {
                  content: installExtensionsScript,
                },
              }
            : {}),
        },
        systemd: {
          services: [
            {
              name: "install-code-server",
              mode: "oneshot" as const,
              deleteAfterSuccess: true,
              exec: ["bash /opt/install-code-server.sh"],
              timeoutSec: 120,
            },
            ...(installExtensionsScript
              ? [
                  {
                    name: "install-code-server-extensions",
                    mode: "oneshot" as const,
                    deleteAfterSuccess: true,
                    exec: ["bash /opt/install-code-server-extensions.sh"],
                    after: ["install-code-server.service"],
                    timeoutSec: 300,
                  },
                ]
              : []),
            {
              name: "code-server",
              mode: "service" as const,
              exec: [args.join(" ")],
              user,
              workdir,
              restartPolicy: {
                policy: "always" as const,
                restartSec: 2,
              },
              after: serviceAfter,
            },
          ],
        },
      }),
    );
  }

  createInstance(): VmVscodeInstance {
    return new VmVscodeInstance(this);
  }

  installServiceName(): string {
    return "install-code-server.service";
  }
}

// ============================================================================
// Instance Class
// ============================================================================

export class VmVscodeInstance extends VmWithInstance {
  builder: VmVscode;
  readonly port: number;

  constructor(builder: VmVscode) {
    super();
    this.builder = builder;
    this.port = builder.options.port;
  }

  /** Expose code-server publicly via Freestyle routing */
  async route({ domain }: { domain: string }): Promise<void> {
    // @ts-expect-error using internal thing
    const freestyle: Freestyle = this.vm._freestyle;
    console.log(
      `Routing code-server on vm ${this.vm.vmId} at port ${this.port} to domain ${domain}`,
    );
    await freestyle.domains.mappings.create({
      domain,
      vmId: this.vm.vmId,
      vmPort: this.port,
    });
  }
}
