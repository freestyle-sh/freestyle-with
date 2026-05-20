import type { VmWith, VmWithInstance } from "freestyle";

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
};

export interface VmVnc<T extends VmVncInstance = VmVncInstance>
  extends VmWith<T> {}

export interface VmVncInstance extends VmWithInstance {
  vncPort(): number;
  noVncPort(): number;
  routeVnc(options?: VncRouteOptions): Promise<VncRoute>;
}
