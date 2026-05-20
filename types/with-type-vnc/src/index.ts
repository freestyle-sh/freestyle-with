import type { VmWith, VmWithInstance } from "freestyle";

export type VncBackend = "x11vnc" | "tigervnc";

export type VncBackendPorts = {
  vncPort: number;
  vncViewOnlyPort: number;
};

export type VncBackendCommandOptions = VncBackendPorts & {
  display: string;
  viewOnly?: boolean;
};

export type VncBackendDefinition = {
  name: VncBackend | string;
  aptDeps: string[];
  installCheck: string;
  additionalFiles?: Record<string, { content: string }>;
  command(options: VncBackendCommandOptions): string;
};

export type VncRouteOptions = {
  domain?: string;
  path?: string;
  viewOnly?: boolean;
};

export type VncRoute = {
  domain: string;
  url: string;
  port: number;
  viewOnly: boolean;
  backend?: VncBackend | string;
};

export interface VmVnc<T extends VmVncInstance = VmVncInstance>
  extends VmWith<T> {}

export interface VmVncInstance extends VmWithInstance {
  vncPort(): number;
  noVncPort(): number;
  routeVnc(options?: VncRouteOptions): Promise<VncRoute>;
}
