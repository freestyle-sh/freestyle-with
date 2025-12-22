import { VmWith, VmWithInstance } from "freestyle-sandboxes";
import { VmTemplate, type CreateVmOptions } from "freestyle-sandboxes";
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

  override configure(
    existingConfig: CreateVmOptions
  ): CreateVmOptions | Promise<CreateVmOptions> {
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

    const nodeJsConfig: CreateVmOptions = {
      template: new VmTemplate({
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
    };

    return this.compose(existingConfig, nodeJsConfig);
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

  async runCode<Result extends JSONValue = any>({
    code,
  }: {
    code: string;
  }): Promise<RunCodeResponse<Result>> {
    const result = await this.vm.exec({
      command: `node -e "${code.replace(/"/g, '\\"')}"`,
    });

    let parsedResult = undefined;
    let error = undefined;

    if (result.stdout) {
      try {
        parsedResult = JSON.parse(result.stdout);
      } catch (e) {
        if (result.stderr) {
          error = `Failed to parse JSON output. Stderr: ${result.stderr}`;
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
