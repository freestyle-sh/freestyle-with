import { VmWith, VmWithInstance } from "freestyle-sandboxes";
import type {
  VmRunCodeInstance,
  VmRunCode,
  RunCodeResponse,
  JSONValue,
} from "@freestyle-sh/with-type-run-code";
import type {
  VmJsInstallDepsInstance,
  InstallOptions,
  InstallResult,
} from "@freestyle-sh/with-type-js-deps";

export type { RunCodeResponse, JSONValue, InstallOptions, InstallResult };

type JavaScriptRuntimeBase<T extends VmWithInstance> = VmWith<T> & VmRunCode<T>;

export interface VmJavaScriptRuntime<
  T extends VmJavaScriptRuntimeInstance = VmJavaScriptRuntimeInstance
> extends JavaScriptRuntimeBase<T> {
  installServiceName(): string;
}

export interface VmJavaScriptRuntimeInstance
  extends VmRunCodeInstance,
    VmJsInstallDepsInstance {}
