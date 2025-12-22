import type { VmWith, VmWithInstance } from "freestyle-sandboxes";

export interface VmJsInstallDeps<T extends VmWithInstance> extends VmWith<T> {}

export type InstallResult = {
  success: boolean;
  stdout?: string;
  stderr?: string;
};

export type InstallOptions =
  | {
      global: true;
      deps: string[];
    }
  | {
      global?: false;
      deps: string[] | Record<string, string>; // ["lodash"] or {"lodash": "^4.0.0"}
      directory?: string;
      dev?: boolean;
    }
  | {
      // Install from package.json
      directory?: string;
      deps?: undefined;
      global?: undefined;
    };

export interface VmJsInstallDepsInstance extends VmWithInstance {
  install(options?: InstallOptions): Promise<InstallResult>;
}
