import type { VmWith, VmWithInstance } from "freestyle-sandboxes";

export interface VmRunCode<T extends VmWithInstance> extends VmWith<T> {}

export type RunCodeResponse<Result extends JSONValue> = {
  result: Result;
  stdout?: string;
  stderr?: string;
  statusCode?: number;
};

export type RunCodeOptions = {
  code: string;
  argv?: string[];
  env?: Record<string, string>;
  workdir?: string;
};

export type RunCodeInput = string | RunCodeOptions;

export type JSONValue =
  | undefined
  | string
  | number
  | boolean
  | null
  | { [x: string]: JSONValue } // Object with string keys and JSON values
  | Array<JSONValue>; // Array of JSON values

export interface VmRunCodeInstance extends VmWithInstance {
  runCode<Result extends JSONValue>(
    options: RunCodeInput,
  ): Promise<RunCodeResponse<Result>>;
}
