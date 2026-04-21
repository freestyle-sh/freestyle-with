import {
  VmBaseImage,
  VmSpec,
  VmWith,
  VmWithInstance,
} from "freestyle";
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
  workspaces: NodeJsWorkspace[] = [];

  constructor(options?: NodeJsOptions) {
    super();
    this.options = {
      version: options?.version ?? "24",
      workdir: options?.workdir,
    };
  }

  override configureBaseImage(
    image: VmBaseImage,
  ): VmBaseImage | Promise<VmBaseImage> {
    return image.runCommands(`
apt-get update
apt-get install -y --no-install-recommends ca-certificates curl
rm -rf /var/lib/apt/lists/*
export NVM_DIR="/opt/nvm"
mkdir -p "$NVM_DIR"
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.3/install.sh | bash
. "$NVM_DIR/nvm.sh"
nvm install ${this.options.version}
nvm alias default ${this.options.version}
printf 'export NVM_DIR="/opt/nvm"\\n[ -s "$NVM_DIR/nvm.sh" ] && . "$NVM_DIR/nvm.sh"\\n[ -s "$NVM_DIR/bash_completion" ] && . "$NVM_DIR/bash_completion"\\n' > /etc/profile.d/nvm.sh
node -v
npm -v`);
  }

  override configureSpec(spec: VmSpec): VmSpec {
    spec.systemdService({
      name: "install-nodejs",
      mode: "oneshot",
      env: {
        HOME: "/root",
        NVM_DIR: "/opt/nvm",
      },
      bash: 'source /opt/nvm/nvm.sh && node -v && npm -v',
      timeoutSec: 30,
    });
    return spec;
  }

  createInstance(): NodeJsRuntimeInstance {
    return new NodeJsRuntimeInstance(this);
  }

  workspace(options: { path: string; install?: boolean }): NodeJsWorkspace {
    const workspace = new NodeJsWorkspace(options);
    this.workspaces.push(workspace);
    return workspace;
  }

  installServiceName(): string {
    return "install-nodejs.service";
  }
}

export class NodeJsWorkspace extends VmWith<NodeJsWorkspaceInstance> {
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
  ): NodeJsWorkspaceTask {
    return new NodeJsWorkspaceTask(
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
    return `nodejs-install-${this.options.path.replace(/\//g, "-")}`;
  }

  override configureSpec(spec: VmSpec): VmSpec {
    if (this.options.install) {
      spec.systemdService({
        name: this.getInstallServiceName(),
        mode: "oneshot",
        bash: "source /opt/nvm/nvm.sh && npm install",
        workdir: this.options.path,
        env: {
          HOME: "/root",
          NVM_DIR: "/opt/nvm",
          ...this.env,
        },
        user: "root",
      });
    }
    return spec;
  }

  override createInstance(): NodeJsWorkspaceInstance {
    return new NodeJsWorkspaceInstance();
  }
}

export class NodeJsWorkspaceInstance extends VmWithInstance {}

export class NodeJsWorkspaceTask extends VmWith<NodeJsWorkspaceTaskInstance> {
  name: string;
  workspace: NodeJsWorkspace;
  env?: Record<string, string>;
  serviceName?: string;

  constructor(
    name: string,
    workspace: NodeJsWorkspace,
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
      `nodejs-workspace-${this.workspace.options.path.replace(/\//g, "-")}-task-${this.name}`
    );
  }

  override configureSpec(spec: VmSpec): VmSpec {
    const installService = this.workspace.options.install
      ? [this.workspace.getInstallServiceName()]
      : [];
    spec.systemdService({
      name: this.getServiceName(),
      bash: `source /opt/nvm/nvm.sh && npm run ${this.name}`,
      workdir: this.workspace.options.path,
      after: installService.length ? installService : undefined,
      requires: installService.length ? installService : undefined,
      env: {
        HOME: "/root",
        NVM_DIR: "/opt/nvm",
        ...this.env,
      },
      user: "root",
    });
    return spec;
  }

  override createInstance(): NodeJsWorkspaceTaskInstance {
    return new NodeJsWorkspaceTaskInstance(
      this.name,
      this.workspace,
      this.env,
      this.serviceName,
    );
  }
}

export class NodeJsWorkspaceTaskInstance extends VmWithInstance {
  name: string;
  workspace: NodeJsWorkspace;
  env?: Record<string, string>;
  serviceName?: string;

  constructor(
    name: string,
    workspace: NodeJsWorkspace,
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
      `nodejs-workspace-${this.workspace.options.path.replace(/\//g, "-")}-task-${this.name}`
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
    const command = `bash -lc ${shellEscape(
      `${cdPrefix}${envPrefix}node -e "${code.replace(/"/g, '\\"')}"${
        argvArgs ? ` -- ${argvArgs}` : ""
      }`,
    )}`;

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
      command = `npm install -g ${options.deps.join(" ")}`;
    } else {
      const cdPrefix = options?.directory ? `cd ${options.directory} && ` : "";

      if (!options?.deps) {
        command = `${cdPrefix}npm install`;
      } else {
        const deps = Array.isArray(options.deps)
          ? options.deps
          : Object.entries(options.deps).map(([pkg, ver]) => `${pkg}@${ver}`);
        const devFlag = options.dev ? " --save-dev" : "";
        command = `${cdPrefix}npm install${devFlag} ${deps.join(" ")}`;
      }
    }

    const shellEscape = (value: string) => `'${value.replace(/'/g, "'\\''")}'`;
    const result = await this.vm.exec({
      command: `bash -lc ${shellEscape(command)}`,
    });

    return {
      success: result.statusCode === 0,
      stdout: result.stdout ?? undefined,
      stderr: result.stderr ?? undefined,
    };
  }
}
