import { VmWith, VmWithInstance } from "freestyle-sandboxes";
import type {
  VmRunCodeInstance,
  VmRunCode,
  RunCodeResponse,
  JSONValue,
} from "@freestyle-sh/with-type-run-code";

export type { RunCodeResponse, JSONValue };

type JavaScriptRuntimeBase<T extends VmWithInstance> = VmWith<T> & VmRunCode<T>;

export interface VmJavaScriptRuntime<
  T extends VmJavaScriptRuntimeInstance = VmJavaScriptRuntimeInstance
> extends JavaScriptRuntimeBase<T> {
  installServiceName(): string;
}

export interface VmJavaScriptRuntimeInstance extends VmRunCodeInstance {}
