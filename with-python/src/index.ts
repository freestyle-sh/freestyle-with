import { VmWith, VmWithInstance } from "freestyle-sandboxes";
import { VmSpec, type CreateVmOptions } from "freestyle-sandboxes";
import type {
  JSONValue,
  RunCodeResponse,
  VmRunCodeInstance,
  VmRunCode,
} from "@freestyle-sh/with-type-run-code";

type PythonOptions = { version?: string; workdir?: string };
type PythonResolvedOptions = { version: string; workdir?: string };

export class VmPython
  extends VmWith<PythonRuntimeInstance>
  implements VmRunCode<VmRunCodeInstance>
{
  constructor() {
    super();
  }

  override configureSnapshotSpec(spec: VmSpec): VmSpec {
    return this.composeSpecs(
      spec,
      new VmSpec({
        aptDeps: ["python3"],
      }),
    );
  }

  createInstance(): PythonRuntimeInstance {
    return new PythonRuntimeInstance(this);
  }
}

class PythonRuntimeInstance
  extends VmWithInstance
  implements VmRunCodeInstance
{
  builder: VmPython;
  constructor(builder: VmPython) {
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
    const command = `${cdPrefix}${envPrefix}python3 -c "${code.replace(/"/g, '\\"')}"${
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
