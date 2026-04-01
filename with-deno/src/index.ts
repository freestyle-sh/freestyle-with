import {
  VmSpec,
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

type DenoOptions = {
  version?: string;
  workdir?: string;
  deleteAfterSuccess?: boolean;
};

type DenoResolvedOptions = {
  version?: string;
  workdir?: string;
  deleteAfterSuccess: boolean;
};

export class VmDeno
  extends VmWith<VmDenoInstance>
  implements VmJavaScriptRuntime<VmJavaScriptRuntimeInstance>
{
  options: DenoResolvedOptions;

  constructor(options?: DenoOptions) {
    super();
    this.options = {
      version: options?.version,
      workdir: options?.workdir,
      deleteAfterSuccess: options?.deleteAfterSuccess ?? true,
    };
  }

  override configureSnapshotSpec(spec: VmSpec): VmSpec {
    const versionArg = this.options.version
      ? ` v${this.options.version}`
      : "";

    const installScript = `#!/bin/bash
set -e
export DENO_INSTALL="/opt/deno"
curl -fsSL https://deno.land/install.sh | sh -s -- --yes${versionArg}
$DENO_INSTALL/bin/deno --version
`;

    const denoInit = `export DENO_INSTALL="/opt/deno"
export PATH="$DENO_INSTALL/bin:$PATH"
`;

    return this.composeSpecs(
      spec,
      new VmSpec({
        additionalFiles: {
          "/opt/install-deno.sh": {
            content: installScript,
          },
          "/etc/profile.d/deno.sh": {
            content: denoInit,
          },
        },
        systemd: {
          services: [
            {
              name: "install-deno",
              mode: "oneshot",
              deleteAfterSuccess: this.options.deleteAfterSuccess,
              env: {
                HOME: "/root",
              },
              exec: ["bash /opt/install-deno.sh"],
              timeoutSec: 300,
            },
          ],
        },
      }),
    );
  }

  createInstance(): VmDenoInstance {
    return new VmDenoInstance(this);
  }

  installServiceName(): string {
    return "install-deno.service";
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

  // runCode() implementation added in Phase 2
  // install() implementation added in Phase 3
}
