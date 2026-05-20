import type { VmWith, VmWithInstance } from "freestyle";

export type DisplayBackendKind = "vnc" | "xpra" | "rdp" | "webrtc" | string;

export type DisplayTransport =
  | "novnc"
  | "xpra-html5"
  | "guacamole"
  | "webrtc"
  | string;

export type DisplayBackendCapabilities = {
  audio: boolean;
  viewOnly: boolean;
  clipboard?: boolean;
  fileTransfer?: boolean;
  fullDesktop?: boolean;
  microphone?: boolean;
  rootless?: boolean;
};

export type DisplayBackendPorts = Record<string, number>;

export type DisplayBackendScreen = {
  width: number;
  height: number;
  depth: number;
};

export type DisplayBackendFile = {
  content: string;
};

export type DisplayBackendService = {
  name: string;
  exec: string;
  after?: string[];
  requires?: string[];
  env?: Record<string, string>;
  user?: string;
};

export type DisplayBackendServiceOptions = {
  display: string;
  displayServiceName?: string;
  ports: DisplayBackendPorts;
  screen: DisplayBackendScreen;
  servicePrefix: string;
  user: string;
};

export type DisplayBackendReadyOptions = Omit<
  DisplayBackendServiceOptions,
  "displayServiceName"
>;

export type DisplayBackendRouteOptions = {
  path?: string;
  ports: DisplayBackendPorts;
  viewOnly: boolean;
};

export type DisplayBackendRouteTarget = {
  path: string;
  port: number;
  viewOnly: boolean;
};

export type DisplayBackendDefinition = {
  name: string;
  kind: DisplayBackendKind;
  transport: DisplayTransport;
  capabilities: DisplayBackendCapabilities;
  /** True when this backend starts the X/desktop session Chromium should use. */
  ownsDisplay?: boolean;
  aptDeps: string[];
  installCheck: string;
  additionalFiles?: Record<string, DisplayBackendFile>;
  readyServiceName?(options: DisplayBackendReadyOptions): string | undefined;
  applicationEnv?(options: DisplayBackendReadyOptions): Record<string, string>;
  services(options: DisplayBackendServiceOptions): DisplayBackendService[];
  routeTarget(options: DisplayBackendRouteOptions): DisplayBackendRouteTarget;
};

export type DisplayRouteOptions = {
  domain?: string;
  path?: string;
  viewOnly?: boolean;
};

export type DisplayRoute = {
  domain: string;
  url: string;
  port: number;
  path: string;
  viewOnly: boolean;
  backend: string;
  kind: DisplayBackendKind;
  transport: DisplayTransport;
  capabilities: DisplayBackendCapabilities;
};

export interface VmDisplay<T extends VmDisplayInstance = VmDisplayInstance>
  extends VmWith<T> {}

export interface VmDisplayInstance extends VmWithInstance {
  displayPorts(): DisplayBackendPorts;
  routeDisplay(options?: DisplayRouteOptions): Promise<DisplayRoute>;
}
