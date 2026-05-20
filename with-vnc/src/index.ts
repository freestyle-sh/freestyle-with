import type {
  VncBackendCommandOptions,
  VncBackendDefinition,
} from "@freestyle-sh/with-type-vnc";

export type {
  VncBackend,
  VncBackendCommandOptions,
  VncBackendDefinition,
  VncBackendPorts,
  VncRoute,
  VncRouteOptions,
  VmVnc,
  VmVncInstance,
} from "@freestyle-sh/with-type-vnc";

const shellEscape = (value: string): string => {
  return `'${value.replace(/'/g, "'\\''")}'`;
};

export class X11VncBackend implements VncBackendDefinition {
  name = "x11vnc" as const;
  aptDeps = ["x11vnc"];
  installCheck = "command -v x11vnc";

  command(options: VncBackendCommandOptions): string {
    return [
      "x11vnc",
      "-display",
      shellEscape(options.display),
      "-forever",
      "-shared",
      "-nopw",
      "-listen",
      "0.0.0.0",
      ...(options.viewOnly ? ["-viewonly"] : []),
      "-rfbport",
      String(options.viewOnly ? options.vncViewOnlyPort : options.vncPort),
    ].join(" ");
  }
}

export class TigerVncBackend implements VncBackendDefinition {
  name = "tigervnc" as const;
  aptDeps = ["tigervnc-scraping-server"];
  installCheck = "command -v x0vncserver || command -v x0tigervncserver";
  additionalFiles = {
    "/opt/freestyle-tigervnc.sh": {
      content: `#!/bin/bash
set -e
export HOME="\${HOME:-/root}"
if command -v x0vncserver >/dev/null 2>&1; then
  exec x0vncserver "$@"
fi
exec x0tigervncserver "$@"
`,
    },
  };

  command(options: VncBackendCommandOptions): string {
    const args = [
      "-fg",
      "-display",
      shellEscape(options.display),
      "-rfbport",
      String(options.viewOnly ? options.vncViewOnlyPort : options.vncPort),
      "-localhost=1",
      "-SecurityTypes=None",
      "-AlwaysShared=1",
      "-DisconnectClients=0",
      "-AcceptSetDesktopSize=0",
      ...(options.viewOnly
        ? [
            "-AcceptPointerEvents=0",
            "-AcceptKeyEvents=0",
          ]
        : [
            "-AcceptPointerEvents=1",
            "-AcceptKeyEvents=1",
          ]),
    ];

    return `bash /opt/freestyle-tigervnc.sh ${args.join(" ")}`;
  }
}
