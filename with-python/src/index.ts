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
    args: string | { code: string },
  ): Promise<RunCodeResponse<Result>> {
    const code = typeof args === "string" ? args : args.code;
    const result = await this.vm.exec({
      command: `python3 -c "${code.replace(/"/g, '\\"')}"`,
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
