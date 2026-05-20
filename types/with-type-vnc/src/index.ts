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
