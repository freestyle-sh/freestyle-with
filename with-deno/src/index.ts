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

type DenoOptions = {
  version?: string;
  workdir?: string;
};

type DenoResolvedOptions = {
  version?: string;
  workdir?: string;
};

export class VmDeno
  extends VmWith<VmDenoInstance>
  implements VmJavaScriptRuntime<VmJavaScriptRuntimeInstance>
{
  options: DenoResolvedOptions;
  workspaces: DenoWorkspace[] = [];

  constructor(options?: DenoOptions) {
    super();
    this.options = {
      version: options?.version,
      workdir: options?.workdir,
    };
  }

  override configureBaseImage(
    image: VmBaseImage,
  ): VmBaseImage | Promise<VmBaseImage> {
    const versionArg = this.options.version ? ` v${this.options.version}` : "";

    return image.runCommands(`
apt-get update
apt-get install -y --no-install-recommends ca-certificates curl unzip
rm -rf /var/lib/apt/lists/*
curl -fsSL https://deno.land/install.sh | DENO_INSTALL="/opt/deno" sh -s -- --yes${versionArg}
/opt/deno/bin/deno --version`);
  }

  override configureSpec(spec: VmSpec): VmSpec {
    spec.systemdService({
      name: "install-deno",
      mode: "oneshot",
      env: {
        HOME: "/root",
      },
      exec: ["/opt/deno/bin/deno --version"],
      timeoutSec: 30,
    });
    return spec;
  }

  workspace(options: { path: string; install?: boolean }): DenoWorkspace {
    const workspace = new DenoWorkspace(options, undefined, this);
    this.workspaces.push(workspace);
    return workspace;
  }

  createInstance(): VmDenoInstance {
    return new VmDenoInstance(this);
  }

  installServiceName(): string {
    return "install-deno.service";
  }
}

export class DenoWorkspace extends VmWith<DenoWorkspaceInstance> {
  options: { path: string; install?: boolean };
  env?: Record<string, string>;
  deno?: VmDeno;

  constructor(
    options: { path: string; install?: boolean },
    env?: Record<string, string>,
    deno?: VmDeno,
  ) {
    super();
    this.options = options;
    this.env = env;
    this.deno = deno;
  }

  task(
    name: string,
    options?: {
      env?: Record<string, string>;
      serviceName?: string;
    },
  ): DenoWorkspaceTask {
    return new DenoWorkspaceTask(
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
    return `deno-install-${this.options.path.replace(/\//g, "-")}`;
  }

  override configureSpec(spec: VmSpec): VmSpec {
    if (this.options.install) {
      spec.systemdService({
        name: this.getInstallServiceName(),
        mode: "oneshot",
        after: this.deno ? [this.deno.installServiceName()] : undefined,
        bash: "/opt/deno/bin/deno install",
        workdir: this.options.path,
        env: {
          HOME: "/root",
          DENO_DIR: "/root/.cache/deno",
          ...this.env,
        },
        user: "root",
      });
    }
    return spec;
  }

  override createInstance(): DenoWorkspaceInstance {
    return new DenoWorkspaceInstance();
  }
}

export class DenoWorkspaceInstance extends VmWithInstance {}

export class DenoWorkspaceTask extends VmWith<DenoWorkspaceTaskInstance> {
  name: string;
  workspace: DenoWorkspace;
  env?: Record<string, string>;
  serviceName?: string;

  constructor(
    name: string,
    workspace: DenoWorkspace,
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
      `deno-workspace-${this.workspace.options.path.replace(/\//g, "-")}-task-${this.name}`
    );
  }

  override configureSpec(spec: VmSpec): VmSpec {
    spec.systemdService({
      name: this.getServiceName(),
      bash: `/opt/deno/bin/deno task ${this.name}`,
      workdir: this.workspace.options.path,
      after: [
        ...(this.workspace.deno ? [this.workspace.deno.installServiceName()] : []),
        ...(this.workspace.options.install ? [this.workspace.getInstallServiceName()] : []),
      ],
      requires: this.workspace.options.install
        ? [this.workspace.getInstallServiceName()]
        : undefined,
      env: {
        HOME: "/root",
        DENO_DIR: "/root/.cache/deno",
        ...this.env,
      },
      user: "root",
    });
    return spec;
  }

  override createInstance(): DenoWorkspaceTaskInstance {
    return new DenoWorkspaceTaskInstance(
      this.name,
      this.workspace,
      this.env,
      this.serviceName,
    );
  }
}

export class DenoWorkspaceTaskInstance extends VmWithInstance {
  name: string;
  workspace: DenoWorkspace;
  env?: Record<string, string>;
  serviceName?: string;

  constructor(
    name: string,
    workspace: DenoWorkspace,
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
      `deno-workspace-${this.workspace.options.path.replace(/\//g, "-")}-task-${this.name}`
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
      | {
          code: string;
          argv?: string[];
          env?: Record<string, string>;
          workdir?: string;
        },
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
          : Object.entries(options.deps).map(
              ([pkg, ver]) => `${prefixDep(pkg)}@${ver}`,
            );
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
