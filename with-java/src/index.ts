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

export class VmJavaInstance
  extends VmWithInstance
  implements VmRunCodeInstance
{
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
    const command = `${cdPrefix}${envPrefix}java -cp /tmp -c "${code.replace(/"/g, '\\"')}"${
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
}

export class VmJava
  extends VmWith<VmJavaInstance>
  implements VmRunCode<VmRunCodeInstance>
{
  constructor(private options: { version: string } = { version: "21" }) {
    super();
  }

  override configureSnapshotSpec(spec: VmSpec): VmSpec {
    const installScript = `#!/bin/bash
set -e
sudo apt-get update
sudo apt-get install -y ca-certificates apt-transport-https gnupg wget

wget -O - https://apt.corretto.aws/corretto.key | sudo gpg --dearmor -o /usr/share/keyrings/corretto-keyring.gpg && \\
echo "deb [signed-by=/usr/share/keyrings/corretto-keyring.gpg] https://apt.corretto.aws stable main" | sudo tee /etc/apt/sources.list.d/corretto.list

sudo apt-get update
sudo apt-get install -y java-${this.options.version}-amazon-corretto-jdk libxi6 libxtst6 libxrender1
`;

    return this.composeSpecs(
      spec,
      new VmSpec({
        additionalFiles: {
          "/opt/install-java.sh": {
            content: installScript,
          },
        },
        systemd: {
          services: [
            {
              name: "install-java",
              mode: "oneshot",
              deleteAfterSuccess: true,
              exec: ["bash /opt/install-java.sh"],
              timeoutSec: 300,
            },
          ],
        },
      }),
    );
  }

  createInstance(): VmJavaInstance {
    return new VmJavaInstance();
  }

  installServiceName(): string {
    return "install-java.service";
  }
}
