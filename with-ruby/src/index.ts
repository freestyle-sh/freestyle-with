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

export type InstallResult = {
  success: boolean;
  stdout?: string;
  stderr?: string;
};

export type InstallOptions =
  | {
      deps: string[];
    }
  | {
      directory?: string;
      deps?: undefined;
    };

type RubyOptions = { version?: string };
type RubyResolvedOptions = { version: string };

export class VmRuby
  extends VmWith<RubyRuntimeInstance>
  implements VmRunCode<VmRunCodeInstance>
{
  options: RubyResolvedOptions;

  constructor(options?: RubyOptions) {
    super();
    this.options = {
      version: options?.version ?? "3.4.8",
    };
  }

  override configureSnapshotSpec(spec: VmSpec): VmSpec {
    // Multi-user install puts RVM in /usr/local/rvm
    // and auto-creates /etc/profile.d/rvm.sh
    // Using 'head' instead of 'stable' to get Ruby 3.3+ support
    const installScript = `#!/bin/bash
set -e
curl -sSL https://get.rvm.io | bash -s -- head
source /etc/profile.d/rvm.sh
rvm install ${this.options.version}
rvm use ${this.options.version} --default
ruby --version
`;

    return this.composeSpecs(
      spec,
      new VmSpec({
        aptDeps: ["curl", "gnupg2", "ca-certificates"],
        additionalFiles: {
          "/opt/install-ruby.sh": {
            content: installScript,
          },
        },
        systemd: {
          services: [
            {
              name: "install-ruby",
              mode: "oneshot",
              deleteAfterSuccess: true,
              exec: ["bash /opt/install-ruby.sh"],
              timeoutSec: 300,
            },
          ],
        },
      }),
    );
  }

  createInstance(): RubyRuntimeInstance {
    return new RubyRuntimeInstance(this);
  }

  installServiceName(): string {
    return "install-ruby.service";
  }
}

class RubyRuntimeInstance extends VmWithInstance implements VmRunCodeInstance {
  builder: VmRuby;

  constructor(builder: VmRuby) {
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
    const command = `${cdPrefix}${envPrefix}/usr/local/rvm/rubies/ruby-${
      this.builder.options.version
    }/bin/ruby -e "${code.replace(/"/g, '\\"')}"${
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
    const gemPath = `/usr/local/rvm/rubies/ruby-${this.builder.options.version}/bin/gem`;

    let command: string;

    if (!options?.deps) {
      // Install from Gemfile
      const cdPrefix = options?.directory ? `cd ${options.directory} && ` : "";
      command = `${cdPrefix}bundle install`;
    } else {
      command = `${gemPath} install ${options.deps.join(" ")}`;
    }

    const result = await this.vm.exec({ command });

    return {
      success: result.statusCode === 0,
      stdout: result.stdout ?? undefined,
      stderr: result.stderr ?? undefined,
    };
  }
}
