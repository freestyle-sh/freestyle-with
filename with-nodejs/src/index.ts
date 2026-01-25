import { VmWith, VmWithInstance } from "freestyle-sandboxes";
import { VmSpec, type CreateVmOptions } from "freestyle-sandboxes";
import type {
  JSONValue,
  RunCodeResponse,
  VmJavaScriptRuntimeInstance,
  VmJavaScriptRuntime,
  InstallOptions,
  InstallResult,
} from "@freestyle-sh/with-type-js";

type NodeJsOptions = { version?: string; workdir?: string };
type NodeJsResolvedOptions = { version: string; workdir?: string };

export class VmNodeJs
  extends VmWith<NodeJsRuntimeInstance>
  implements VmJavaScriptRuntime<VmJavaScriptRuntimeInstance>
{
  options: NodeJsResolvedOptions;

  constructor(options?: NodeJsOptions) {
    super();
    this.options = {
      version: options?.version ?? "24",
      workdir: options?.workdir,
    };
  }

  override configureSnapshotSpec(spec: VmSpec): VmSpec {
    const installScript = `#!/bin/bash
set -e
export NVM_DIR="/opt/nvm"
mkdir -p "$NVM_DIR"
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.3/install.sh | bash
source "$NVM_DIR/nvm.sh"
nvm install ${this.options.version}
nvm alias default ${this.options.version}
node -v
npm -v
`;

    // load nvm into all user's shells
    const nvmInit = `export NVM_DIR="/opt/nvm"
[ -s "$NVM_DIR/nvm.sh" ] && . "$NVM_DIR/nvm.sh"
[ -s "$NVM_DIR/bash_completion" ] && . "$NVM_DIR/bash_completion"
`;

    return this.composeSpecs(
      spec,
      new VmSpec({
        additionalFiles: {
          "/opt/install-nodejs.sh": {
            content: installScript,
          },
          "/etc/profile.d/nvm.sh": {
            content: nvmInit,
          },
        },
        systemd: {
          services: [
            {
              name: "install-nodejs",
              mode: "oneshot",
              deleteAfterSuccess: true,
              exec: ["bash /opt/install-nodejs.sh"],
              timeoutSec: 300,
            },
          ],
        },
      }),
    );
  }

  createInstance(): NodeJsRuntimeInstance {
    return new NodeJsRuntimeInstance(this);
  }

  installServiceName(): string {
    return `install-nodejs.service`;
  }
}

class NodeJsRuntimeInstance
  extends VmWithInstance
  implements VmJavaScriptRuntimeInstance
{
  builder: VmNodeJs;
  constructor(builder: VmNodeJs) {
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
    const command = `${cdPrefix}${envPrefix}node -e "${code.replace(/"/g, '\\"')}"${
      argvArgs ? ` -- ${argvArgs}` : ""
    }`;

    const result = await this.vm.exec({
      command,
    });

    let parsedResult = undefined;
    let error = undefined;

    if (result.stdout) {
      const lines = result.stdout
        .split(/\r?\n/)
        .map((line) => line.trim())
        .filter((line) => line.length > 0);
      const lastLine = lines[lines.length - 1];

      if (lastLine) {
        try {
          parsedResult = JSON.parse(lastLine);
        } catch (e) {
          if (result.stderr) {
            error = `Failed to parse JSON output. Stderr: ${result.stderr}`;
          }
        }
      }
    }

    return {
      result: parsedResult,
      stdout: result.stdout ?? undefined,
      stderr: result.stderr ?? undefined,
      statusCode: result.statusCode ?? -1,
    };
  }

  async install(options?: InstallOptions): Promise<InstallResult> {
    let command: string;

    if (options?.global) {
      command = `npm install -g ${options.deps.join(" ")}`;
    } else {
      const cdPrefix = options?.directory ? `cd ${options.directory} && ` : "";

      if (!options?.deps) {
        // Install from package.json
        command = `${cdPrefix}npm install`;
      } else {
        const deps = Array.isArray(options.deps)
          ? options.deps
          : Object.entries(options.deps).map(([pkg, ver]) => `${pkg}@${ver}`);
        const devFlag = options.dev ? " --save-dev" : "";
        command = `${cdPrefix}npm install${devFlag} ${deps.join(" ")}`;
      }
    }

    const result = await this.vm.exec({ command });

    return {
      success: result.statusCode === 0,
      stdout: result.stdout ?? undefined,
      stderr: result.stderr ?? undefined,
    };
  }
}
