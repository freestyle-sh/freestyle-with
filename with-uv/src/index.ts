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
    args:
      | string
      | { code: string; argv?: string[]; env?: Record<string, string>; workdir?: string },
  ): Promise<RunCodeResponse<Result>> {
    const options = typeof args === "string" ? { code: args } : args;
    const { code, argv, env, workdir } = options;
    const shellEscape = (value: string) => `'${value.replace(/'/g, "'\\''")}'`;
    const argvArgs = argv?.map(shellEscape).join(" ");
    const envPrefix = env
      ? `${Object.entries(env)
          .map(([key, value]) => `${key}=${shellEscape(value)}`)
          .join(" ")} `
      : "";
    const cdPrefix = workdir ? `cd ${shellEscape(workdir)} && ` : "";
    const command = `${cdPrefix}${envPrefix}/opt/uv/bin/uv run python -c "${code.replace(/"/g, '\\"')}"${
      argvArgs ? ` -- ${argvArgs}` : ""
    }`;

    const result = await this.vm.exec({
      command,
    });

    let parsedResult = undefined;

    if (result.stdout) {
      const lines = result.stdout
        .split(/\r?\n/)
        .map((line) => line.trim())
        .filter((line) => line.length > 0);
      const lastLine = lines[lines.length - 1];

      if (lastLine) {
        try {
          parsedResult = JSON.parse(lastLine);
        } catch (e) {}
      }
    }

    return {
      result: parsedResult,
      stdout: result.stdout ?? undefined,
      stderr: result.stderr ?? undefined,
      statusCode: result.statusCode ?? -1,
    };
  }
}
