import type { VmWith, VmWithInstance } from "freestyle";

export type BrowserRouteOptions = {
  domain?: string;
};

export type BrowserRoute = {
  domain: string;
  url: string;
  port: number;
};

export type BrowserWSEndpointOptions = BrowserRouteOptions & {
  route?: boolean;
};

export type BrowserCdpVersion = {
  Browser?: string;
  "Protocol-Version"?: string;
  "User-Agent"?: string;
  "V8-Version"?: string;
  "WebKit-Version"?: string;
  webSocketDebuggerUrl?: string;
  [key: string]: unknown;
};

export interface VmBrowser<
  T extends VmBrowserInstance = VmBrowserInstance,
> extends VmWith<T> {
  installServiceName(): string;
}

export interface VmBrowserInstance extends VmWithInstance {
  cdpPort(): number;
  route(options?: BrowserRouteOptions): Promise<BrowserRoute>;
  cdpJsonVersion(): Promise<BrowserCdpVersion>;
  browserWSEndpoint(options?: BrowserWSEndpointOptions): Promise<string>;
}
