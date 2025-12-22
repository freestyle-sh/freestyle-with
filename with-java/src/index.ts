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

export class VmJavaInstance
  extends VmWithInstance
  implements VmRunCodeInstance
{
  async runCode<Result extends JSONValue = any>({
    code,
  }: {
    code: string;
  }): Promise<RunCodeResponse<Result>> {
    const result = await this.vm.exec({
      command: `java -cp /tmp -c "${code.replace(/"/g, '\\"')}"`,
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
}

export class VmJava
  extends VmWith<VmJavaInstance>
  implements VmRunCode<VmRunCodeInstance>
{
  constructor(private options: { version: string } = { version: "21" }) {
    super();
  }

  override configure(
    existingConfig: CreateVmOptions
  ): CreateVmOptions | Promise<CreateVmOptions> {
    const installScript = `#!/bin/bash
set -e
sudo apt-get update
sudo apt-get install -y ca-certificates apt-transport-https gnupg wget

wget -O - https://apt.corretto.aws/corretto.key | sudo gpg --dearmor -o /usr/share/keyrings/corretto-keyring.gpg && \\
echo "deb [signed-by=/usr/share/keyrings/corretto-keyring.gpg] https://apt.corretto.aws stable main" | sudo tee /etc/apt/sources.list.d/corretto.list

sudo apt-get update
sudo apt-get install -y java-${this.options.version}-amazon-corretto-jdk libxi6 libxtst6 libxrender1
`;

    const javaConfig: CreateVmOptions = {
      template: new VmTemplate({
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
    };

    return this.compose(existingConfig, javaConfig);
  }

  createInstance(): VmJavaInstance {
    return new VmJavaInstance();
  }

  installServiceName(): string {
    return "install-java.service";
  }
}
