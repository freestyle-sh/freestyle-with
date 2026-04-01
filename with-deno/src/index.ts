import {
  VmSpec,
  VmWith,
  VmWithInstance,
} from "freestyle-sandboxes";
import type {
  JSONValue,
  RunCodeResponse,
  VmJavaScriptRuntimeInstance,
  VmJavaScriptRuntime,
  InstallOptions,
  InstallResult,
} from "@freestyle-sh/with-type-js";

type DenoOptions = {
  version?: string;
  workdir?: string;
  deleteAfterSuccess?: boolean;
};

type DenoResolvedOptions = {
  version?: string;
  workdir?: string;
  deleteAfterSuccess: boolean;
};

export class VmDeno
  extends VmWith<VmDenoInstance>
  implements VmJavaScriptRuntime<VmJavaScriptRuntimeInstance>
{
  options: DenoResolvedOptions;

  constructor(options?: DenoOptions) {
    super();
    this.options = {
      version: options?.version,
      workdir: options?.workdir,
      deleteAfterSuccess: options?.deleteAfterSuccess ?? true,
    };
  }

  override configureSnapshotSpec(spec: VmSpec): VmSpec {
    const versionArg = this.options.version
      ? ` v${this.options.version}`
      : "";

    const installScript = `#!/bin/bash
set -e
export DENO_INSTALL="/opt/deno"
curl -fsSL https://deno.land/install.sh | sh -s -- --yes${versionArg}
$DENO_INSTALL/bin/deno --version
`;

    const denoInit = `export DENO_INSTALL="/opt/deno"
export PATH="$DENO_INSTALL/bin:$PATH"
`;

    return this.composeSpecs(
      spec,
      new VmSpec({
        additionalFiles: {
          "/opt/install-deno.sh": {
            content: installScript,
          },
          "/etc/profile.d/deno.sh": {
            content: denoInit,
          },
        },
        systemd: {
          services: [
            {
              name: "install-deno",
              mode: "oneshot",
              deleteAfterSuccess: this.options.deleteAfterSuccess,
              env: {
                HOME: "/root",
              },
              exec: ["bash /opt/install-deno.sh"],
              timeoutSec: 300,
            },
          ],
        },
      }),
    );
  }

  createInstance(): VmDenoInstance {
    return new VmDenoInstance(this);
  }

  installServiceName(): string {
    return "install-deno.service";
  }
}

class VmDenoInstance
  extends VmWithInstance
  implements VmJavaScriptRuntimeInstance
{
  builder: VmDeno;

  constructor(builder: VmDeno) {
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
    const command = `${cdPrefix}${envPrefix}/opt/deno/bin/deno eval "${code.replace(/"/g, '\\"')}"${
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

  async install(options?: InstallOptions): Promise<InstallResult> {
    let command: string;

    // Helper to add npm: prefix to bare package names
    const prefixDep = (dep: string): string => {
      if (dep.startsWith("npm:") || dep.startsWith("jsr:")) {
        return dep;
      }
      return `npm:${dep}`;
    };

    if (options?.global) {
      const deps = options.deps.map(prefixDep);
      command = `/opt/deno/bin/deno install --global --allow-all ${deps.join(" ")}`;
    } else {
      const cdPrefix = options?.directory ? `cd ${options.directory} && ` : "";

      if (!options?.deps) {
        // Install from deno.json
        command = `${cdPrefix}/opt/deno/bin/deno install`;
      } else {
        const deps = Array.isArray(options.deps)
          ? options.deps.map(prefixDep)
          : Object.entries(options.deps).map(([pkg, ver]) => `${prefixDep(pkg)}@${ver}`);
        const devFlag = options.dev ? " --dev" : "";
        command = `${cdPrefix}/opt/deno/bin/deno add${devFlag} ${deps.join(" ")}`;
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
