import {
  VmTemplate,
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
      global: true;
      deps: string[];
    }
  | {
      global?: false;
      deps: string[] | Record<string, string>;
      directory?: string;
      dev?: boolean;
    }
  | {
      directory?: string;
      deps?: undefined;
      global?: undefined;
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

  override configure(
    existingConfig: CreateVmOptions
  ): CreateVmOptions | Promise<CreateVmOptions> {
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

    const rubyConfig: CreateVmOptions = {
      template: new VmTemplate({
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
    };

    return this.compose(existingConfig, rubyConfig);
  }

  createInstance(): RubyRuntimeInstance {
    return new RubyRuntimeInstance(this);
  }

  installServiceName(): string {
    return "install-ruby.service";
  }
}

class RubyRuntimeInstance
  extends VmWithInstance
  implements VmRunCodeInstance
{
  builder: VmRuby;

  constructor(builder: VmRuby) {
    super();
    this.builder = builder;
  }

  async runCode<Result extends JSONValue = any>({
    code,
  }: {
    code: string;
  }): Promise<RunCodeResponse<Result>> {
    const result = await this.vm.exec({
      command: `/usr/local/rvm/rubies/ruby-${this.builder.options.version}/bin/ruby -e "${code.replace(/"/g, '\\"')}"`,
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

  async install(options?: InstallOptions): Promise<InstallResult> {
    const gemPath = `/usr/local/rvm/rubies/ruby-${this.builder.options.version}/bin/gem`;

    let command: string;

    if (options?.global) {
      command = `${gemPath} install ${options.deps.join(" ")}`;
    } else {
      const cdPrefix = options?.directory ? `cd ${options.directory} && ` : "";

      if (!options?.deps) {
        // Install from Gemfile
        command = `${cdPrefix}bundle install`;
      } else {
        const deps = Array.isArray(options.deps)
          ? options.deps
          : Object.entries(options.deps).map(([pkg, ver]) => `${pkg}:${ver}`);
        command = `${cdPrefix}${gemPath} install ${deps.join(" ")}`;
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
