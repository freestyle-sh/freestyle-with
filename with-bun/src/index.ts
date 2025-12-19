import {
  VmTemplate,
  type CreateVmOptions,
  VmWith,
  VmWithInstance,
} from "freestyle-sandboxes";
import type {
  JSONValue,
  RunCodeResponse,
  VmJavaScriptRuntimeInstance,
  VmJavaScriptRuntime,
} from "@freestyle-sh/with-type-js";

type BunJsOptions = { version?: string; workdir?: string };
type BunJsResolvedOptions = { version?: string; workdir?: string };

export class VmBun
  extends VmWith<VmBunInstance>
  implements VmJavaScriptRuntime<VmJavaScriptRuntimeInstance>
{
  options: BunJsResolvedOptions;

  constructor(options?: BunJsOptions) {
    super();
    this.options = {
      version: options?.version,
      workdir: options?.workdir,
    };
  }

  override configure(
    existingConfig: CreateVmOptions
  ): CreateVmOptions | Promise<CreateVmOptions> {
    const versionArg = this.options.version
      ? ` -s "bun-v${this.options.version}"`
      : "";

    const installScript = `#!/bin/bash
set -e
export BUN_INSTALL="/opt/bun"
curl -fsSL https://bun.sh/install | bash${versionArg}
$BUN_INSTALL/bin/bun --version
`;

    const bunInit = `export BUN_INSTALL="/opt/bun"
export PATH="$BUN_INSTALL/bin:$PATH"
`;

    const bunConfig: CreateVmOptions = {
      template: new VmTemplate({
        additionalFiles: {
          "/opt/install-bun.sh": {
            content: installScript,
          },
          "/etc/profile.d/bun.sh": {
            content: bunInit,
          },
        },
        systemd: {
          services: [
            {
              name: "install-bun",
              mode: "oneshot",
              deleteAfterSuccess: true,
              exec: ["bash /opt/install-bun.sh"],
              timeoutSec: 300,
            },
          ],
        },
      }),
    };

    return this.compose(existingConfig, bunConfig);
  }

  createInstance(): VmBunInstance {
    return new VmBunInstance(this);
  }

  installServiceName(): string {
    return "install-bun.service";
  }
}

class VmBunInstance
  extends VmWithInstance
  implements VmJavaScriptRuntimeInstance
{
  builder: VmBun;

  constructor(builder: VmBun) {
    super();
    this.builder = builder;
  }

  async runCode<Result extends JSONValue = any>(
    code: string
  ): Promise<RunCodeResponse<Result>> {
    const result = await this.vm.exec({
      command: `/opt/bun/bin/bun -e "${code.replace(/"/g, '\\"')}"`,
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
