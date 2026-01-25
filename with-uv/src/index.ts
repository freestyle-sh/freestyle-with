import {
  VmSpec,
  type CreateVmOptions,
  VmWith,
  VmWithInstance,
} from "freestyle-sandboxes";
import type {
  JSONValue,
  RunCodeResponse,
  VmRunCodeInstance,
  VmRunCode,
} from "@freestyle-sh/with-type-run-code";

type UvOptions = { version?: string; pythonVersion?: string };
type UvResolvedOptions = { version?: string; pythonVersion: string };

export class VmUv
  extends VmWith<VmUvInstance>
  implements VmRunCode<VmRunCodeInstance>
{
  options: UvResolvedOptions;

  constructor(options?: UvOptions) {
    super();
    this.options = {
      version: options?.version,
      pythonVersion: options?.pythonVersion ?? "3.14",
    };
  }

  override configureSnapshotSpec(spec: VmSpec): VmSpec {
    const versionArg = this.options.version
      ? `UV_VERSION="${this.options.version}" `
      : "";

    const installScript = `#!/bin/bash
set -e
export UV_INSTALL_DIR="/opt/uv/bin"
${versionArg}curl -LsSf https://astral.sh/uv/install.sh | sh
/opt/uv/bin/uv python install ${this.options.pythonVersion}
/opt/uv/bin/uv --version
`;

    const uvInit = `export PATH="/opt/uv/bin:$PATH"
`;

    return this.composeSpecs(
      spec,
      new VmSpec({
        additionalFiles: {
          "/opt/install-uv.sh": {
            content: installScript,
          },
          "/etc/profile.d/uv.sh": {
            content: uvInit,
          },
        },
        systemd: {
          services: [
            {
              name: "install-uv",
              mode: "oneshot",
              deleteAfterSuccess: true,
              exec: ["bash /opt/install-uv.sh"],
              timeoutSec: 300,
            },
          ],
        },
      }),
    );
  }

  createInstance(): VmUvInstance {
    return new VmUvInstance(this);
  }

  installServiceName(): string {
    return "install-uv.service";
  }
}

class VmUvInstance extends VmWithInstance implements VmRunCodeInstance {
  builder: VmUv;

  constructor(builder: VmUv) {
    super();
    this.builder = builder;
  }

  async runCode<Result extends JSONValue = any>(
    args: string | { code: string },
  ): Promise<RunCodeResponse<Result>> {
    const code = typeof args === "string" ? args : args.code;
    const result = await this.vm.exec({
      command: `/opt/uv/bin/uv run python -c "${code.replace(/"/g, '\\"')}"`,
    });

    let parsedResult = undefined;

    if (result.stdout) {
      try {
        parsedResult = JSON.parse(result.stdout);
      } catch (e) {}
    }

    return {
      result: parsedResult,
      stdout: result.stdout ?? undefined,
      stderr: result.stderr ?? undefined,
      statusCode: result.statusCode ?? -1,
    };
  }
}
