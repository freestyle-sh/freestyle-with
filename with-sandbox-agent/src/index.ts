import {
  VmSpec,
  VmWith,
  VmWithInstance,
  type Freestyle,
} from "freestyle-sandboxes";
import { SandboxAgent } from "sandbox-agent";

type KnownEnvKeys =
  | "ANTHROPIC_API_KEY"
  | "OPENAI_API_KEY"
  | "AMP_API_KEY";

type EnvRecord = Partial<Record<KnownEnvKeys, string>> & Record<string, string>;

export type VmSandboxAgentOptions = {
  host?: string;
  port?: number;
  token?: string;
  env?: EnvRecord;
};

export type VmSandboxAgentResolvedOptions = {
  host: string;
  port: number;
  token?: string;
  env: Record<string, string>;
};

export class VmSandboxAgent extends VmWith<VmSandboxAgentInstance> {
  options: VmSandboxAgentResolvedOptions;

  constructor(options?: VmSandboxAgentOptions) {
    super();
    this.options = {
      host: options?.host ?? "0.0.0.0",
      port: options?.port ?? 2468,
      token: options?.token,
      env: options?.env ?? {},
    };
  }

  override configureSnapshotSpec(spec: VmSpec): VmSpec {
    const envExports = Object.entries(this.options.env)
      .map(([k, v]) => `export ${k}="${v}"`)
      .join("\n");
    const tokenExport = this.options.token
      ? `export SANDBOX_TOKEN="${this.options.token}"`
      : "";
    const tokenArg = this.options.token
      ? `--token "$SANDBOX_TOKEN"`
      : "--no-token";

    return this.composeSpecs(
      spec,
      new VmSpec({
        additionalFiles: {
          "/opt/install-sandbox-agent.sh": {
            content: `#!/bin/bash
set -e
export PATH="/root/.sandbox-agent/bin:$PATH"
curl -fsSL https://releases.rivet.dev/sandbox-agent/latest/install.sh | sh
`,
          },
          "/opt/preinstall-agents.sh": {
            content: `#!/bin/bash
set -e
export PATH="/root/.sandbox-agent/bin:$PATH"
sandbox-agent install-agent claude
sandbox-agent install-agent codex
sandbox-agent install-agent opencode
sandbox-agent install-agent amp
`,
          },
          "/opt/run-sandbox-agent.sh": {
            content: `#!/bin/bash
export PATH="/root/.sandbox-agent/bin:$PATH"
${tokenExport}
${envExports}
sandbox-agent server ${tokenArg} --host ${this.options.host} --port ${this.options.port}
`,
          },
        },
        systemd: {
          services: [
            {
              name: "install-sandbox-agent",
              mode: "oneshot",
              exec: ["bash /opt/install-sandbox-agent.sh"],
              timeoutSec: 300,
            },
            {
              name: "preinstall-agents",
              mode: "oneshot",
              after: ["install-sandbox-agent.service"],
              requires: ["install-sandbox-agent.service"],
              exec: ["bash /opt/preinstall-agents.sh"],
              timeoutSec: 600,
            },
            {
              name: "sandbox-agent",
              mode: "service",
              after: ["preinstall-agents.service"],
              requires: ["preinstall-agents.service"],
              restartPolicy: {
                policy: "always",
              },
              exec: ["bash /opt/run-sandbox-agent.sh"],
            },
          ],
        },
      }),
    );
  }

  createInstance(): VmSandboxAgentInstance {
    return new VmSandboxAgentInstance(this);
  }

  installServiceName(): string {
    return "install-sandbox-agent.service";
  }
}

class VmSandboxAgentInstance extends VmWithInstance {
  builder: VmSandboxAgent;

  constructor(builder: VmSandboxAgent) {
    super();
    this.builder = builder;
  }

  port(): number {
    return this.builder.options.port;
  }

  host(): string {
    return this.builder.options.host;
  }

  async client({ domain }: { domain?: string } = {}) {
    const resolvedDomain =
      domain ?? `${crypto.randomUUID()}-sandbox-agent.style.dev`;
    // @ts-expect-error using internal thing
    const freestyle: Freestyle = this._vm._freestyle;
    await freestyle.domains.mappings.create({
      domain: resolvedDomain,
      vmId: this.vm.vmId,
      vmPort: this.port(),
    });

    const client = await SandboxAgent.connect({
      baseUrl: `https://${resolvedDomain}`,
      token: this.builder.options.token,
    });

    return { client, domain: resolvedDomain };
  }

  /** @internal */
  get _vm() {
    return this.vm;
  }
}
