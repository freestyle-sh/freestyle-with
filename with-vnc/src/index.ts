import type {
  DisplayBackendDefinition,
  DisplayBackendPorts,
  DisplayBackendRouteOptions,
  DisplayBackendRouteTarget,
  DisplayBackendService,
  DisplayBackendServiceOptions,
} from "@freestyle-sh/with-type-display";
import type {
  VncBackendCommandOptions,
  VncBackendDefinition,
} from "@freestyle-sh/with-type-vnc";

export type {
  DisplayBackendCapabilities,
  DisplayBackendDefinition,
  DisplayBackendKind,
  DisplayBackendPorts,
  DisplayBackendRouteOptions,
  DisplayBackendRouteTarget,
  DisplayBackendReadyOptions,
  DisplayBackendService,
  DisplayBackendServiceOptions,
  DisplayRoute,
  DisplayRouteOptions,
  DisplayTransport,
  VmDisplay,
  VmDisplayInstance,
} from "@freestyle-sh/with-type-display";
export type {
  VncBackend,
  VncBackendCommandOptions,
  VncBackendDefinition,
  VncBackendPorts,
} from "@freestyle-sh/with-type-vnc";

const shellEscape = (value: string): string => {
  return `'${value.replace(/'/g, "'\\''")}'`;
};

const requirePort = (ports: DisplayBackendPorts, name: string): number => {
  const port = ports[name];
  if (typeof port !== "number") {
    throw new Error(`Missing display backend port: ${name}.`);
  }

  return port;
};

const noVncPath = (path: string, viewOnly: boolean): string => {
  if (!viewOnly) {
    return path;
  }

  const url = new URL(path, "https://vnc.local");
  url.searchParams.set("view_only", "1");
  return `${url.pathname}${url.search}${url.hash}`;
};

const ensureDistinctPorts = (ports: Record<string, number>): void => {
  const seen = new Map<number, string>();

  for (const [name, port] of Object.entries(ports)) {
    const existing = seen.get(port);
    if (existing) {
      throw new Error(
        `noVNC display ports must be distinct: ${existing} and ${name} both use ${port}.`,
      );
    }

    seen.set(port, name);
  }
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

export type NoVncDisplayBackendOptions = {
  vncBackend?: VncBackendDefinition;
};

export class NoVncDisplayBackend implements DisplayBackendDefinition {
  kind = "vnc" as const;
  transport = "novnc" as const;
  ownsDisplay = false;
  capabilities = {
    audio: false,
    clipboard: true,
    fullDesktop: true,
    viewOnly: true,
  };
  vncBackend: VncBackendDefinition;

  constructor(options: NoVncDisplayBackendOptions = {}) {
    this.vncBackend = options.vncBackend ?? new TigerVncBackend();
  }

  get name(): string {
    return this.vncBackend.name;
  }

  get aptDeps(): string[] {
    return ["novnc", "websockify", ...this.vncBackend.aptDeps];
  }

  get installCheck(): string {
    return [
      this.vncBackend.installCheck,
      "command -v websockify",
      "test -d /usr/share/novnc",
    ].join("\n");
  }

  get additionalFiles() {
    return this.vncBackend.additionalFiles;
  }

  services(options: DisplayBackendServiceOptions): DisplayBackendService[] {
    if (!options.displayServiceName) {
      throw new Error("noVNC display backend requires an existing X display service.");
    }

    const vncPort = requirePort(options.ports, "vnc");
    const vncViewOnlyPort = requirePort(options.ports, "vncViewOnly");
    const webPort = requirePort(options.ports, "web");
    const webViewOnlyPort = requirePort(options.ports, "webViewOnly");
    ensureDistinctPorts({
      vnc: vncPort,
      vncViewOnly: vncViewOnlyPort,
      web: webPort,
      webViewOnly: webViewOnlyPort,
    });

    const interactiveVncService = `${options.servicePrefix}-vnc`;
    const interactiveNoVncService = `${options.servicePrefix}-novnc`;
    const viewOnlyVncService = `${options.servicePrefix}-vnc-viewonly`;
    const viewOnlyNoVncService = `${options.servicePrefix}-novnc-viewonly`;

    return [
      {
        name: interactiveVncService,
        exec: this.vncBackend.command({
          display: options.display,
          vncPort,
          vncViewOnlyPort,
        }),
        after: [options.displayServiceName],
        requires: [options.displayServiceName],
      },
      {
        name: interactiveNoVncService,
        exec: this.websockifyCommand(webPort, vncPort),
        after: [`${interactiveVncService}.service`],
        requires: [`${interactiveVncService}.service`],
      },
      {
        name: viewOnlyVncService,
        exec: this.vncBackend.command({
          display: options.display,
          vncPort,
          vncViewOnlyPort,
          viewOnly: true,
        }),
        after: [options.displayServiceName],
        requires: [options.displayServiceName],
      },
      {
        name: viewOnlyNoVncService,
        exec: this.websockifyCommand(webViewOnlyPort, vncViewOnlyPort),
        after: [`${viewOnlyVncService}.service`],
        requires: [`${viewOnlyVncService}.service`],
      },
    ];
  }

  routeTarget(
    options: DisplayBackendRouteOptions,
  ): DisplayBackendRouteTarget {
    const port = options.viewOnly
      ? requirePort(options.ports, "webViewOnly")
      : requirePort(options.ports, "web");
    const path = noVncPath(
      options.path ?? "/vnc.html?autoconnect=1&resize=remote",
      options.viewOnly,
    );

    return {
      path,
      port,
      viewOnly: options.viewOnly,
    };
  }

  private websockifyCommand(webPort: number, vncPort: number): string {
    return [
      "websockify",
      "--web=/usr/share/novnc",
      `0.0.0.0:${webPort}`,
      `127.0.0.1:${vncPort}`,
    ].join(" ");
  }
}
