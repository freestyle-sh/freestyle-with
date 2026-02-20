import { VmSpec, VmWith, VmWithInstance } from "freestyle-sandboxes";
import type {
  JSONValue,
  RunCodeResponse,
  VmJavaScriptRuntimeInstance,
  VmJavaScriptRuntime,
  InstallOptions,
  InstallResult,
} from "@freestyle-sh/with-type-js";

type PlaywrightOptions = {
  nodeVersion?: string;
  playwrightVersion?: string;
  installDeps?: boolean;
  browsers?: Array<"chromium" | "firefox" | "webkit">;
};

type PlaywrightResolvedOptions = {
  nodeVersion: string;
  playwrightVersion?: string;
  installDeps: boolean;
  browsers?: Array<"chromium" | "firefox" | "webkit">;
};

export class VmPlaywright
  extends VmWith<PlaywrightRuntimeInstance>
  implements VmJavaScriptRuntime<VmJavaScriptRuntimeInstance>
{
  options: PlaywrightResolvedOptions;

  constructor(options?: PlaywrightOptions) {
    super();
    this.options = {
      nodeVersion: options?.nodeVersion ?? "24",
      playwrightVersion: options?.playwrightVersion,
      installDeps: options?.installDeps ?? true,
      browsers: options?.browsers,
    };
  }

  override configureSnapshotSpec(spec: VmSpec): VmSpec {
    const playwrightVersionArg = this.options.playwrightVersion
      ? `@${this.options.playwrightVersion}`
      : "";

    const browserArgs = this.options.browsers?.length
      ? ` ${this.options.browsers.join(" ")}`
      : "";

    const depsFlag = this.options.installDeps ? " --with-deps" : "";

    const installScript = `#!/bin/bash
set -e
export NVM_DIR="/opt/nvm"
mkdir -p "$NVM_DIR"
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.3/install.sh | bash
source "$NVM_DIR/nvm.sh"
nvm install ${this.options.nodeVersion}
nvm alias default ${this.options.nodeVersion}
node -v
npm -v

export PLAYWRIGHT_BROWSERS_PATH="/opt/playwright-browsers"
mkdir -p /opt/playwright-browsers
mkdir -p /opt/playwright
cd /opt/playwright
npm init -y
npm install playwright${playwrightVersionArg}
npx playwright install${depsFlag}${browserArgs}
`;

    const nvmInit = `export NVM_DIR="/opt/nvm"
[ -s "$NVM_DIR/nvm.sh" ] && . "$NVM_DIR/nvm.sh"
[ -s "$NVM_DIR/bash_completion" ] && . "$NVM_DIR/bash_completion"
`;

    const playwrightEnv = `export PLAYWRIGHT_BROWSERS_PATH="/opt/playwright-browsers"
export NODE_PATH="/opt/playwright/node_modules"
`;

    return this.composeSpecs(
      spec,
      new VmSpec({
        additionalFiles: {
          "/opt/install-playwright.sh": {
            content: installScript,
          },
          "/etc/profile.d/nvm.sh": {
            content: nvmInit,
          },
          "/etc/profile.d/playwright.sh": {
            content: playwrightEnv,
          },
        },
        systemd: {
          services: [
            {
              name: "install-playwright",
              mode: "oneshot",
              deleteAfterSuccess: true,
              exec: ["bash /opt/install-playwright.sh"],
              timeoutSec: 600,
            },
          ],
        },
      }),
    );
  }

  createInstance(): PlaywrightRuntimeInstance {
    return new PlaywrightRuntimeInstance(this);
  }

  installServiceName(): string {
    return "install-playwright.service";
  }
}

class PlaywrightRuntimeInstance
  extends VmWithInstance
  implements VmJavaScriptRuntimeInstance
{
  builder: VmPlaywright;

  constructor(builder: VmPlaywright) {
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
    const mergedEnv = {
      NODE_PATH: "/opt/playwright/node_modules",
      PLAYWRIGHT_BROWSERS_PATH: "/opt/playwright-browsers",
      ...(env ?? {}),
    };
    const envPrefix = Object.entries(mergedEnv)
      .map(([key, value]) => `${key}=${shellEscape(value)}`)
      .join(" ");
    const cdPrefix = workdir ? `cd ${shellEscape(workdir)} && ` : "";
    const command = `${cdPrefix}${envPrefix ? `${envPrefix} ` : ""}node -e "${code.replace(/"/g, '\\"')}"${
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

    const result = await this.vm.exec({ command });

    return {
      success: result.statusCode === 0,
      stdout: result.stdout ?? undefined,
      stderr: result.stderr ?? undefined,
    };
  }
}
