import {
  VmSpec,
  type CreateVmOptions,
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

type BunJsOptions = { version?: string; workdir?: string, deleteAfterSuccess?: boolean };
type BunJsResolvedOptions = { version?: string; workdir?: string, deleteAfterSuccess: boolean };

export class VmBun
  extends VmWith<VmBunInstance>
  implements VmJavaScriptRuntime<VmJavaScriptRuntimeInstance>
{
  options: BunJsResolvedOptions;
  workspaces: BunWorkspace[] = [];

  constructor(options?: BunJsOptions) {
    super();
    this.options = {
      version: options?.version,
      workdir: options?.workdir,
      deleteAfterSuccess: options?.deleteAfterSuccess ?? true,
    };
  }

  override configureSnapshotSpec(spec: VmSpec): VmSpec {
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

    return this.composeSpecs(
      spec,
      new VmSpec({
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
              deleteAfterSuccess: this.options.deleteAfterSuccess,
              env: {
                HOME: "/root",
              },
              exec: ["bash /opt/install-bun.sh"],
              timeoutSec: 300,
            },
          ],
        },
      }),
    );
  }

  createInstance(): VmBunInstance {
    return new VmBunInstance(this);
  }

  workspace(options: { path: string; install?: boolean }): BunWorkspace {
    const workspace = new BunWorkspace(options);
    this.workspaces.push(workspace);
    return workspace;
  }

  installServiceName(): string {
    return "install-bun.service";
  }
}

export class BunWorkspace extends VmWith<BunWorkspaceInstance> {
  options: { path: string; install?: boolean };
  env?: Record<string, string>;

  constructor(
    options: { path: string; install?: boolean },
    env?: Record<string, string>,
  ) {
    super();
    this.options = options;
    this.env = env;
  }

  task(
    name: string,
    options?: {
      env?: Record<string, string>;
      serviceName?: string;
    },
  ): BunWorkspaceTask {
    return new BunWorkspaceTask(
      name,
      this,
      {
        ...this.env,
        ...options?.env,
      },
      options?.serviceName,
    );
  }

  getInstallServiceName(): string {
    return `bun-install-${this.options.path.replace(/\//g, "-")}`;
  }

  override configureSpec(spec: VmSpec): VmSpec {
    if (this.options.install) {
      return this.composeSpecs(
        spec,
        new VmSpec({
          systemd: {
            services: [
              {
                name: this.getInstallServiceName(),
                mode: "oneshot",
                exec: ["/opt/bun/bin/bun install"],
                workdir: this.options.path,
                env: {
                  HOME: "/root",
                  BUN_INSTALL: "/opt/bun",
                  PATH: "/opt/bun/bin:/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin",
                  ...this.env,
                },
                user: "root",
              },
            ],
          },
        }),
      );
    }
    return spec;
  }

  override createInstance(): BunWorkspaceInstance {
    return new BunWorkspaceInstance();
  }
}

export class BunWorkspaceInstance extends VmWithInstance {}

export class BunWorkspaceTask extends VmWith<BunWorkspaceTaskInstance> {
  name: string;
  workspace: BunWorkspace;
  env?: Record<string, string>;
  serviceName?: string;

  constructor(
    name: string,
    workspace: BunWorkspace,
    env?: Record<string, string>,
    serviceName?: string,
  ) {
    super();
    this.name = name;
    this.workspace = workspace;
    this.env = env;
    this.serviceName = serviceName;
  }

  getServiceName(): string {
    return (
      this.serviceName ??
      `bun-workspace-${this.workspace.options.path.replace(/\//g, "-")}-task-${this.name}`
    );
  }

  override configureSpec(spec: VmSpec): VmSpec {
    return this.composeSpecs(
      spec,
      new VmSpec({
        systemd: {
          services: [
            {
              name: this.getServiceName(),
              exec: [`/opt/bun/bin/bun run ${this.name}`],
              workdir: this.workspace.options.path,
              after: this.workspace.options.install
                ? [this.workspace.getInstallServiceName()]
                : undefined,
              requires: this.workspace.options.install
                ? [this.workspace.getInstallServiceName()]
                : undefined,
              env: {
                HOME: "/root",
                BUN_INSTALL: "/opt/bun",
                PATH: "/opt/bun/bin:/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin",
                ...this.env,
              },
              user: "root",
            },
          ],
        },
      }),
    );
  }

  override createInstance(): BunWorkspaceTaskInstance {
    return new BunWorkspaceTaskInstance(
      this.name,
      this.workspace,
      this.env,
      this.serviceName,
    );
  }
}

export class BunWorkspaceTaskInstance extends VmWithInstance {
  name: string;
  workspace: BunWorkspace;
  env?: Record<string, string>;
  serviceName?: string;

  constructor(
    name: string,
    workspace: BunWorkspace,
    env?: Record<string, string>,
    serviceName?: string,
  ) {
    super();
    this.name = name;
    this.workspace = workspace;
    this.env = env;
    this.serviceName = serviceName;
  }

  getServiceName(): string {
    return (
      this.serviceName ??
      `bun-workspace-${this.workspace.options.path.replace(/\//g, "-")}-task-${this.name}`
    );
  }

  logs() {
    return this.vm
      .exec({
        command: `journalctl -u ${this.getServiceName()} --no-pager -n 30`,
      })
      .then((result) => result.stdout?.trim().split("\n"));
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
    const command = `${cdPrefix}${envPrefix}/opt/bun/bin/bun -e "${code.replace(/"/g, '\\"')}"${
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

    if (options?.global) {
      command = `/opt/bun/bin/bun add -g ${options.deps.join(" ")}`;
    } else {
      const cdPrefix = options?.directory ? `cd ${options.directory} && ` : "";

      if (!options?.deps) {
        // Install from package.json
        command = `${cdPrefix}/opt/bun/bin/bun install`;
      } else {
        const deps = Array.isArray(options.deps)
          ? options.deps
          : Object.entries(options.deps).map(([pkg, ver]) => `${pkg}@${ver}`);
        const devFlag = options.dev ? " -d" : "";
        command = `${cdPrefix}/opt/bun/bin/bun add${devFlag} ${deps.join(" ")}`;
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
