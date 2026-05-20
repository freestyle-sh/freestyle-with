import {
  VmSpec,
  VmWith,
  VmWithInstance,
  type Freestyle,
} from "freestyle";
import type {
  BrowserCdpVersion,
  BrowserRoute,
  BrowserRouteOptions,
  BrowserWSEndpointOptions,
  VmBrowser,
  VmBrowserInstance,
} from "@freestyle-sh/with-type-browser";
import type {
  ComputerUseAction,
  ComputerUseActionResult,
  ComputerUseClickOptions,
  ComputerUseCoordinate,
  ComputerUseDisplaySize,
  ComputerUseDoubleClickOptions,
  ComputerUseDragOptions,
  ComputerUseKeyOptions,
  ComputerUseMouseButton,
  ComputerUseMoveOptions,
  ComputerUseRegion,
  ComputerUseResult,
  ComputerUseScreenshot,
  ComputerUseScrollOptions,
  ComputerUseTypeOptions,
  ComputerUseToolDefinition,
  ComputerUseToolOptions,
  VmComputerUse,
  VmComputerUseInstance,
} from "@freestyle-sh/with-type-computer-use";
import type {
  VmVnc,
  VmVncInstance,
  VncRoute,
  VncRouteOptions,
} from "@freestyle-sh/with-type-vnc";

export type ChromiumMode = "headless" | "headed";

export type ChromiumScreen = {
  width?: number;
  height?: number;
  depth?: number;
};

export type VmChromiumOptions = {
  /** Launch Chromium with a visible X11 display or Chrome's native headless mode. */
  mode?: ChromiumMode;
  /** Chrome DevTools Protocol port (default: 9222). */
  cdpPort?: number;
  /** Internal HTTP/WebSocket proxy port used when routing CDP publicly. */
  cdpRoutePort?: number;
  /** X11 display used in headed mode (default: :99). */
  display?: string;
  /** Virtual display size used in headed mode. */
  screen?: ChromiumScreen;
  /** Chromium user-data directory. */
  userDataDir?: string;
  /** User that runs Chromium and desktop services (default: root). */
  user?: string;
  /** Page opened when Chromium starts. */
  homepage?: string;
  /** Extra flags appended to the Chromium command. */
  extraArgs?: string[];
  /** Environment passed to Chromium. */
  env?: Record<string, string>;
  /** Start x11vnc and noVNC in headed mode (default: true in headed mode). */
  enableVnc?: boolean;
  /** Raw VNC port used inside the VM (default: 5900). */
  vncPort?: number;
  /** Raw view-only VNC port used inside the VM (default: vncPort + 1). */
  vncViewOnlyPort?: number;
  /** noVNC/websockify HTTP port used for Freestyle routing (default: 6080). */
  noVncPort?: number;
  /** View-only noVNC/websockify HTTP port (default: noVncPort + 1). */
  noVncViewOnlyPort?: number;
};

export type VmChromiumResolvedOptions = {
  mode: ChromiumMode;
  cdpPort: number;
  cdpRoutePort: number;
  display: string;
  screen: Required<ChromiumScreen>;
  userDataDir: string;
  user: string;
  homepage: string;
  extraArgs: string[];
  env: Record<string, string>;
  enableVnc: boolean;
  vncPort: number;
  vncViewOnlyPort: number;
  noVncPort: number;
  noVncViewOnlyPort: number;
};

const DEFAULT_SCREEN: Required<ChromiumScreen> = {
  width: 1280,
  height: 720,
  depth: 24,
};

const CHROMIUM_BINARY = "/usr/bin/chromium";
const COMPUTER_USE_SCREENSHOT_DELAY_MS = 2000;

export class VmChromium
  extends VmWith<VmChromiumInstance>
  implements
    VmBrowser<VmBrowserInstance>,
    VmVnc<VmVncInstance>,
    VmComputerUse<VmComputerUseInstance>
{
  options: VmChromiumResolvedOptions;

  constructor(options?: VmChromiumOptions) {
    super();

    const mode = options?.mode ?? (options?.enableVnc ? "headed" : "headless");
    const enableVnc = options?.enableVnc ?? mode === "headed";
    const user = options?.user ?? "root";
    const homeDir = user === "root" ? "/root" : `/home/${user}`;

    if (mode === "headless" && enableVnc) {
      throw new Error("VmChromium VNC requires mode: \"headed\".");
    }

    const vncPort = options?.vncPort ?? 5900;
    const vncViewOnlyPort = options?.vncViewOnlyPort ?? vncPort + 1;
    const noVncPort = options?.noVncPort ?? 6080;
    const noVncViewOnlyPort = options?.noVncViewOnlyPort ?? noVncPort + 1;

    if (enableVnc && vncPort === vncViewOnlyPort) {
      throw new Error("VmChromium VNC ports must be distinct.");
    }

    if (enableVnc && noVncPort === noVncViewOnlyPort) {
      throw new Error("VmChromium noVNC ports must be distinct.");
    }

    this.options = {
      mode,
      cdpPort: options?.cdpPort ?? 9222,
      cdpRoutePort: options?.cdpRoutePort ?? (options?.cdpPort ?? 9222) + 1,
      display: options?.display ?? ":99",
      screen: {
        width: options?.screen?.width ?? DEFAULT_SCREEN.width,
        height: options?.screen?.height ?? DEFAULT_SCREEN.height,
        depth: options?.screen?.depth ?? DEFAULT_SCREEN.depth,
      },
      userDataDir:
        options?.userDataDir ?? `${homeDir}/.config/freestyle-chromium`,
      user,
      homepage: options?.homepage ?? "about:blank",
      extraArgs: options?.extraArgs ?? [],
      env: options?.env ?? {},
      enableVnc,
      vncPort,
      vncViewOnlyPort,
      noVncPort,
      noVncViewOnlyPort,
    };
  }

  override configureSnapshotSpec(spec: VmSpec): VmSpec {
    return this.composeChromiumSpec(spec);
  }

  override configureSpec(spec: VmSpec): VmSpec {
    return this.composeChromiumSpec(spec);
  }

  createInstance(): VmChromiumInstance {
    return new VmChromiumInstance(this);
  }

  installServiceName(): string {
    return "install-chromium.service";
  }

  private needsDisplay(): boolean {
    return this.options.mode === "headed";
  }

  private aptDeps(): string[] {
    return [
      "ca-certificates",
      "curl",
      "chromium",
      "fonts-liberation",
      "python3",
      ...(this.needsDisplay()
        ? [
            "dbus-x11",
            "imagemagick",
            "openbox",
            "x11-utils",
            "xdotool",
            "xvfb",
          ]
        : []),
      ...(this.options.enableVnc ? ["novnc", "websockify", "x11vnc"] : []),
    ];
  }

  private composeChromiumSpec(spec: VmSpec): VmSpec {
    const { enableVnc } = this.options;
    const needsDisplay = this.needsDisplay();

    const services = [
      {
        name: "install-chromium",
        mode: "oneshot" as const,
        deleteAfterSuccess: true,
        bash: this.installCheckScript(),
        timeoutSec: 60,
      },
      ...(needsDisplay
        ? [
            {
              name: "chromium-xvfb",
              mode: "service" as const,
              exec: [this.xvfbCommand()],
              restartPolicy: {
                policy: "always" as const,
                restartSec: 2,
              },
              after: [this.installServiceName()],
              requires: [this.installServiceName()],
            },
            {
              name: "chromium-openbox",
              mode: "service" as const,
              exec: ["openbox"],
              env: {
                DISPLAY: this.options.display,
              },
              user: this.options.user,
              restartPolicy: {
                policy: "always" as const,
                restartSec: 2,
              },
              after: ["chromium-xvfb.service"],
              requires: ["chromium-xvfb.service"],
            },
          ]
        : []),
      {
        name: "chromium",
        mode: "service" as const,
        exec: ["bash /opt/run-chromium.sh"],
        user: this.options.user,
        env: this.chromiumEnv(),
        restartPolicy: {
          policy: "always" as const,
          restartSec: 2,
        },
        after: needsDisplay
          ? ["chromium-openbox.service"]
          : [this.installServiceName()],
        requires: needsDisplay
          ? ["chromium-xvfb.service"]
          : [this.installServiceName()],
      },
      {
        name: "chromium-cdp-proxy",
        mode: "service" as const,
        exec: ["python3 /opt/chromium-cdp-proxy.py"],
        restartPolicy: {
          policy: "always" as const,
          restartSec: 2,
        },
        after: ["chromium.service"],
        requires: ["chromium.service"],
      },
      ...(enableVnc
        ? [
            {
              name: "chromium-x11vnc",
              mode: "service" as const,
              exec: [this.x11vncCommand()],
              restartPolicy: {
                policy: "always" as const,
                restartSec: 2,
              },
              after: ["chromium-xvfb.service"],
              requires: ["chromium-xvfb.service"],
            },
            {
              name: "chromium-novnc",
              mode: "service" as const,
              exec: [this.noVncCommand()],
              restartPolicy: {
                policy: "always" as const,
                restartSec: 2,
              },
              after: ["chromium-x11vnc.service"],
              requires: ["chromium-x11vnc.service"],
            },
            {
              name: "chromium-x11vnc-viewonly",
              mode: "service" as const,
              exec: [this.x11vncCommand({ viewOnly: true })],
              restartPolicy: {
                policy: "always" as const,
                restartSec: 2,
              },
              after: ["chromium-xvfb.service"],
              requires: ["chromium-xvfb.service"],
            },
            {
              name: "chromium-novnc-viewonly",
              mode: "service" as const,
              exec: [this.noVncCommand({ viewOnly: true })],
              restartPolicy: {
                policy: "always" as const,
                restartSec: 2,
              },
              after: ["chromium-x11vnc-viewonly.service"],
              requires: ["chromium-x11vnc-viewonly.service"],
            },
          ]
        : []),
    ];

    return this.composeSpecs(
      spec,
      new VmSpec({
        aptDeps: this.aptDeps(),
        additionalFiles: {
          "/opt/run-chromium.sh": {
            content: this.chromiumRunScript(),
          },
          "/opt/chromium-cdp-proxy.py": {
            content: this.cdpProxyScript(),
          },
        },
        systemd: {
          services,
        },
      }),
    );
  }

  private installCheckScript(): string {
    const displayChecks = this.needsDisplay()
      ? `
command -v Xvfb
command -v openbox
command -v import
command -v xdpyinfo
command -v xdotool
`
      : "";
    const vncChecks = this.options.enableVnc
      ? `
command -v x11vnc
command -v websockify
test -d /usr/share/novnc
`
      : "";

    return `set -e
test -x ${this.shellEscape(CHROMIUM_BINARY)}
command -v python3
${CHROMIUM_BINARY} --version
${displayChecks}${vncChecks}`;
  }

  private xvfbCommand(): string {
    const { display, screen } = this.options;
    return [
      "Xvfb",
      this.shellEscape(display),
      "-screen",
      "0",
      `${screen.width}x${screen.height}x${screen.depth}`,
      "-ac",
      "+extension",
      "RANDR",
    ].join(" ");
  }

  private x11vncCommand(options: { viewOnly?: boolean } = {}): string {
    const { display, vncPort, vncViewOnlyPort } = this.options;
    return [
      "x11vnc",
      "-display",
      this.shellEscape(display),
      "-forever",
      "-shared",
      "-nopw",
      "-listen",
      "0.0.0.0",
      ...(options.viewOnly ? ["-viewonly"] : []),
      "-rfbport",
      String(options.viewOnly ? vncViewOnlyPort : vncPort),
    ].join(" ");
  }

  private noVncCommand(options: { viewOnly?: boolean } = {}): string {
    const { noVncPort, noVncViewOnlyPort, vncPort, vncViewOnlyPort } =
      this.options;
    return [
      "websockify",
      "--web=/usr/share/novnc",
      `0.0.0.0:${options.viewOnly ? noVncViewOnlyPort : noVncPort}`,
      `127.0.0.1:${options.viewOnly ? vncViewOnlyPort : vncPort}`,
    ].join(" ");
  }

  private chromiumEnv(): Record<string, string> {
    return {
      HOME:
        this.options.user === "root" ? "/root" : `/home/${this.options.user}`,
      XDG_RUNTIME_DIR: "/tmp/freestyle-chromium-runtime",
      ...(this.needsDisplay() ? { DISPLAY: this.options.display } : {}),
      ...this.options.env,
    };
  }

  private chromiumRunScript(): string {
    const { cdpPort, homepage, userDataDir, extraArgs, screen } = this.options;
    const args = [
      CHROMIUM_BINARY,
      "--no-sandbox",
      "--no-first-run",
      "--no-default-browser-check",
      "--disable-dev-shm-usage",
      "--disable-background-networking",
      "--disable-sync",
      "--remote-allow-origins=*",
      "--remote-debugging-address=0.0.0.0",
      `--remote-debugging-port=${cdpPort}`,
      `--user-data-dir=${userDataDir}`,
      this.options.mode === "headless" ? "--headless=new" : null,
      this.options.mode === "headed"
        ? `--window-size=${screen.width},${screen.height}`
        : null,
      ...extraArgs,
      homepage,
    ].filter((arg): arg is string => Boolean(arg));

    const envExports = Object.entries(this.chromiumEnv())
      .map(([key, value]) => {
        this.validateEnvKey(key);
        return `export ${key}=${this.shellEscape(value)}`;
      })
      .join("\n");

    return `#!/bin/bash
set -e
${envExports}
mkdir -p "$XDG_RUNTIME_DIR" ${this.shellEscape(userDataDir)}
chmod 700 "$XDG_RUNTIME_DIR"
exec ${args.map((arg) => this.shellEscape(arg)).join(" ")}
`;
  }

  private cdpProxyScript(): string {
    const { cdpPort, cdpRoutePort } = this.options;

    return `#!/usr/bin/env python3
import asyncio

LISTEN_HOST = "0.0.0.0"
LISTEN_PORT = ${cdpRoutePort}
TARGET_HOST = "127.0.0.1"
TARGET_PORT = ${cdpPort}


async def pipe(reader, writer):
    try:
        while True:
            data = await reader.read(65536)
            if not data:
                break
            writer.write(data)
            await writer.drain()
    except Exception:
        pass
    finally:
        try:
            writer.close()
            await writer.wait_closed()
        except Exception:
            pass


async def handle(client_reader, client_writer):
    try:
        header = await client_reader.readuntil(b"\\r\\n\\r\\n")
    except asyncio.IncompleteReadError as error:
        header = error.partial
        if not header:
            client_writer.close()
            await client_writer.wait_closed()
            return

    try:
        target_reader, target_writer = await asyncio.open_connection(
            TARGET_HOST,
            TARGET_PORT,
        )
    except Exception:
        client_writer.write(
            b"HTTP/1.1 502 Bad Gateway\\r\\nContent-Length: 0\\r\\n\\r\\n",
        )
        await client_writer.drain()
        client_writer.close()
        await client_writer.wait_closed()
        return

    lines = header.split(b"\\r\\n")
    rewritten = []
    saw_host = False

    for line in lines:
        lower = line.lower()
        if lower.startswith(b"host:"):
            rewritten.append(f"Host: {TARGET_HOST}:{TARGET_PORT}".encode())
            saw_host = True
        elif lower.startswith(b"origin:"):
            rewritten.append(f"Origin: http://{TARGET_HOST}:{TARGET_PORT}".encode())
        else:
            rewritten.append(line)

    if not saw_host and rewritten:
        rewritten.insert(1, f"Host: {TARGET_HOST}:{TARGET_PORT}".encode())

    target_writer.write(b"\\r\\n".join(rewritten))
    await target_writer.drain()

    await asyncio.gather(
        pipe(client_reader, target_writer),
        pipe(target_reader, client_writer),
    )


async def main():
    server = await asyncio.start_server(handle, LISTEN_HOST, LISTEN_PORT)
    async with server:
        await server.serve_forever()


asyncio.run(main())
`;
  }

  private shellEscape(value: string): string {
    return `'${value.replace(/'/g, "'\\''")}'`;
  }

  private validateEnvKey(key: string): void {
    if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(key)) {
      throw new Error(`Invalid env var name: ${key}`);
    }
  }
}

export class VmChromiumInstance
  extends VmWithInstance
  implements VmBrowserInstance, VmVncInstance, VmComputerUseInstance
{
  builder: VmChromium;

  constructor(builder: VmChromium) {
    super();
    this.builder = builder;
  }

  cdpPort(): number {
    return this.builder.options.cdpPort;
  }

  cdpRoutePort(): number {
    return this.builder.options.cdpRoutePort;
  }

  vncPort(): number {
    return this.builder.options.vncPort;
  }

  noVncPort(): number {
    return this.builder.options.noVncPort;
  }

  async computerUseTool(
    options: ComputerUseToolOptions = {},
  ): Promise<ComputerUseToolDefinition> {
    const display = await this.getDisplaySize();
    const type = options.type ?? "computer_20251124";
    const tool = {
      name: "computer" as const,
      display_width_px: display.width,
      display_height_px: display.height,
      allowed_callers: options.allowed_callers,
      cache_control: options.cache_control,
      defer_loading: options.defer_loading,
      display_number: options.display_number ?? this.displayNumber(),
      input_examples: options.input_examples,
      strict: options.strict,
    };

    if (type === "computer_20251124") {
      return {
        ...tool,
        type,
        enable_zoom: options.enable_zoom ?? true,
      };
    }

    return {
      ...tool,
      type,
    };
  }

  async computerUse(action: ComputerUseAction): Promise<ComputerUseResult> {
    this.ensureHeaded();

    switch (action.action) {
      case "screenshot": {
        const screenshot = await this.screenshot();
        return {
          success: true,
          base64_image: screenshot.data,
        };
      }
      case "cursor_position": {
        const result = await this.displayExec("xdotool getmouselocation --shell");
        if (result.statusCode !== 0) {
          return this.toComputerUseResult(result);
        }

        const output = result.stdout ?? "";
        const x = output.match(/^X=(\d+)$/m)?.[1];
        const y = output.match(/^Y=(\d+)$/m)?.[1];

        return {
          success: true,
          output: x && y ? `X=${x},Y=${y}` : output.trim(),
          stdout: result.stdout ?? undefined,
          stderr: result.stderr ?? undefined,
        };
      }
      case "mouse_move": {
        const [x, y] = this.validateCoordinate(action.coordinate);
        return await this.computerUseExec(`xdotool mousemove --sync ${x} ${y}`, {
          takeScreenshot: true,
        });
      }
      case "left_click_drag": {
        const [startX, startY] = this.validateCoordinate(
          action.start_coordinate,
        );
        const [endX, endY] = this.validateCoordinate(action.coordinate);
        return await this.computerUseExec(
          `xdotool mousemove --sync ${startX} ${startY} mousedown 1 mousemove --sync ${endX} ${endY} mouseup 1`,
          { takeScreenshot: true },
        );
      }
      case "left_click":
      case "right_click":
      case "middle_click":
      case "double_click":
      case "triple_click": {
        const commands: string[] = ["xdotool"];

        if (action.coordinate) {
          const [x, y] = this.validateCoordinate(action.coordinate);
          commands.push(`mousemove --sync ${x} ${y}`);
        }

        if (action.key) {
          commands.push(`keydown ${this.shellEscape(action.key)}`);
        }

        commands.push(`click ${this.clickButtonArg(action.action)}`);

        if (action.key) {
          commands.push(`keyup ${this.shellEscape(action.key)}`);
        }

        return await this.computerUseExec(commands.join(" "), {
          takeScreenshot: true,
        });
      }
      case "type": {
        return await this.computerUseExec(
          `xdotool type --clearmodifiers --delay 12 -- ${this.shellEscape(
            action.text,
          )}`,
          { takeScreenshot: true },
        );
      }
      case "key": {
        return await this.computerUseExec(
          `xdotool key --clearmodifiers -- ${this.shellEscape(action.text)}`,
          { takeScreenshot: true },
        );
      }
      case "left_mouse_down":
      case "left_mouse_up": {
        const command =
          action.action === "left_mouse_down" ? "mousedown 1" : "mouseup 1";
        return await this.computerUseExec(`xdotool ${command}`, {
          takeScreenshot: true,
        });
      }
      case "scroll": {
        const scrollAmount = this.validateNonNegativeInt(
          action.scroll_amount,
          "scroll_amount",
        );
        const scrollButton = {
          up: 4,
          down: 5,
          left: 6,
          right: 7,
        }[action.scroll_direction];

        if (!scrollButton) {
          throw new Error(
            "scroll_direction must be one of up, down, left, or right.",
          );
        }

        if (scrollAmount === 0) {
          return await this.resultWithScreenshot({ success: true });
        }

        const commands: string[] = ["xdotool"];

        if (action.coordinate) {
          const [x, y] = this.validateCoordinate(action.coordinate);
          commands.push(`mousemove --sync ${x} ${y}`);
        }

        if (action.text) {
          commands.push(`keydown ${this.shellEscape(action.text)}`);
        }

        commands.push(`click --repeat ${scrollAmount} ${scrollButton}`);

        if (action.text) {
          commands.push(`keyup ${this.shellEscape(action.text)}`);
        }

        return await this.computerUseExec(commands.join(" "), {
          takeScreenshot: true,
        });
      }
      case "hold_key": {
        const duration = this.validateDuration(action.duration);
        return await this.computerUseExec(
          `xdotool keydown ${this.shellEscape(
            action.text,
          )} sleep ${duration} keyup ${this.shellEscape(
            action.text,
          )}`,
          { takeScreenshot: true },
        );
      }
      case "wait": {
        await this.sleep(this.validateDuration(action.duration) * 1000);
        return await this.resultWithScreenshot({ success: true });
      }
      case "zoom": {
        const [x0, y0, x1, y1] = this.validateRegion(action.region);
        const width = x1 - x0;
        const height = y1 - y0;

        if (width <= 0 || height <= 0) {
          throw new Error("zoom region must have positive width and height.");
        }

        const result = await this.displayExec(
          `import -window root png:- | convert - -crop ${width}x${height}+${x0}+${y0} +repage png:- | base64 -w0`,
        );

        if (result.statusCode !== 0) {
          return this.toComputerUseResult(result);
        }

        return {
          success: true,
          base64_image: (result.stdout ?? "").trim(),
          stdout: result.stdout ?? undefined,
          stderr: result.stderr ?? undefined,
        };
      }
    }
  }

  async route(options: BrowserRouteOptions = {}): Promise<BrowserRoute> {
    const domain = options.domain ?? `${crypto.randomUUID()}-chromium.style.dev`;
    await this.freestyle().domains.mappings.create({
      domain,
      vmId: this.vm.vmId,
      vmPort: this.cdpRoutePort(),
    });

    return {
      domain,
      port: this.cdpRoutePort(),
      url: `https://${domain}`,
    };
  }

  async routeVnc(options: VncRouteOptions = {}): Promise<VncRoute> {
    this.ensureVncEnabled();

    const viewOnly = options.viewOnly ?? false;
    const port = viewOnly
      ? this.builder.options.noVncViewOnlyPort
      : this.noVncPort();
    const domain =
      options.domain ?? `${crypto.randomUUID()}-chromium-vnc.style.dev`;
    await this.freestyle().domains.mappings.create({
      domain,
      vmId: this.vm.vmId,
      vmPort: port,
    });

    const path = this.noVncPath(
      options.path ?? "/vnc.html?autoconnect=1&resize=remote",
      viewOnly,
    );
    return {
      domain,
      port,
      viewOnly,
      url: `https://${domain}${path.startsWith("/") ? path : `/${path}`}`,
    };
  }

  async cdpJsonVersion(): Promise<BrowserCdpVersion> {
    const result = await this.vm.exec({
      command: `curl -fsS http://127.0.0.1:${this.cdpPort()}/json/version`,
    });

    if (result.statusCode !== 0) {
      throw new Error(result.stderr ?? "Failed to read Chromium CDP version.");
    }

    return JSON.parse(result.stdout ?? "{}") as BrowserCdpVersion;
  }

  async browserWSEndpoint(
    options: BrowserWSEndpointOptions = {},
  ): Promise<string> {
    const version = await this.cdpJsonVersion();
    const endpoint = version.webSocketDebuggerUrl;

    if (!endpoint) {
      throw new Error("Chromium did not return a webSocketDebuggerUrl.");
    }

    if (!options.route && !options.domain) {
      return endpoint;
    }

    const route = await this.route({ domain: options.domain });
    return endpoint.replace(/^ws:\/\/[^/]+/, route.url.replace(/^http/, "ws"));
  }

  async getDisplaySize(): Promise<ComputerUseDisplaySize> {
    this.ensureHeaded();

    const result = await this.displayExec(
      "xdpyinfo | awk '/dimensions:/ { print $2; exit }'",
    );
    if (result.statusCode !== 0) {
      throw new Error(result.stderr ?? "Failed to get display size.");
    }

    const match = (result.stdout ?? "").match(/(\d+)x(\d+)/);
    if (!match) {
      throw new Error(`Unexpected display size output: ${result.stdout}`);
    }

    return {
      width: Number(match[1]),
      height: Number(match[2]),
    };
  }

  async screenshot(options?: {
    path?: string;
  }): Promise<ComputerUseScreenshot> {
    this.ensureHeaded();

    const target = options?.path ? this.shellEscape(options.path) : undefined;
    const command = target
      ? `import -window root ${target} && base64 -w0 ${target}`
      : "import -window root png:- | base64 -w0";

    const [result, size] = await Promise.all([
      this.displayExec(command),
      this.getDisplaySize(),
    ]);

    if (result.statusCode !== 0) {
      throw new Error(result.stderr ?? "Failed to capture screenshot.");
    }

    return {
      mimeType: "image/png",
      data: (result.stdout ?? "").trim(),
      width: size.width,
      height: size.height,
    };
  }

  async click(
    options: ComputerUseClickOptions,
  ): Promise<ComputerUseActionResult> {
    const button = this.buttonNumber(options.button);
    return await this.computerUseExec(
      `xdotool mousemove --sync ${options.x} ${options.y} click ${button}`,
    );
  }

  async doubleClick(
    options: ComputerUseDoubleClickOptions,
  ): Promise<ComputerUseActionResult> {
    const button = this.buttonNumber(options.button);
    const delayMs = options.delayMs ?? 100;
    return await this.computerUseExec(
      `xdotool mousemove --sync ${options.x} ${options.y} click --repeat 2 --delay ${delayMs} ${button}`,
    );
  }

  async move(
    options: ComputerUseMoveOptions,
  ): Promise<ComputerUseActionResult> {
    return await this.computerUseExec(
      `xdotool mousemove --sync ${options.x} ${options.y}`,
    );
  }

  async drag(
    options: ComputerUseDragOptions,
  ): Promise<ComputerUseActionResult> {
    const button = this.buttonNumber(options.button);
    return await this.computerUseExec(
      [
        "xdotool",
        `mousemove --sync ${options.from.x} ${options.from.y}`,
        `mousedown ${button}`,
        `mousemove --sync ${options.to.x} ${options.to.y}`,
        `mouseup ${button}`,
      ].join(" "),
    );
  }

  async scroll(
    options: ComputerUseScrollOptions,
  ): Promise<ComputerUseActionResult> {
    const commands: string[] = [];

    if (options.x !== undefined && options.y !== undefined) {
      commands.push(`mousemove --sync ${options.x} ${options.y}`);
    }

    const pushScrollClicks = (button: number, count: number) => {
      for (let i = 0; i < count; i++) {
        commands.push(`click ${button}`);
      }
    };

    const deltaY = options.deltaY ?? 0;
    if (deltaY > 0) {
      pushScrollClicks(5, Math.ceil(deltaY));
    } else if (deltaY < 0) {
      pushScrollClicks(4, Math.ceil(Math.abs(deltaY)));
    }

    const deltaX = options.deltaX ?? 0;
    if (deltaX > 0) {
      pushScrollClicks(7, Math.ceil(deltaX));
    } else if (deltaX < 0) {
      pushScrollClicks(6, Math.ceil(Math.abs(deltaX)));
    }

    if (commands.length === 0) {
      return { success: true };
    }

    return await this.computerUseExec(`xdotool ${commands.join(" ")}`);
  }

  async type(
    options: ComputerUseTypeOptions,
  ): Promise<ComputerUseActionResult> {
    const delayMs = options.delayMs ?? 0;
    return await this.computerUseExec(
      `xdotool type --clearmodifiers --delay ${delayMs} -- ${this.shellEscape(
        options.text,
      )}`,
    );
  }

  async key(options: ComputerUseKeyOptions): Promise<ComputerUseActionResult> {
    const keys = Array.isArray(options.keys) ? options.keys : [options.keys];
    return await this.computerUseExec(
      `xdotool key --clearmodifiers ${keys
        .map((key) => this.shellEscape(key))
        .join(" ")}`,
    );
  }

  async logs(options?: { unit?: string; lines?: number }): Promise<string[]> {
    const unit = options?.unit ?? "chromium";
    const lines = options?.lines ?? 100;
    const result = await this.vm.exec({
      command: `journalctl -u ${this.shellEscape(unit)} --no-pager -n ${lines}`,
    });
    return (result.stdout ?? "").trim().split(/\r?\n/).filter(Boolean);
  }

  private async computerUseExec(
    command: string,
    options: { takeScreenshot?: boolean } = {},
  ): Promise<ComputerUseActionResult> {
    this.ensureHeaded();

    const result = this.toComputerUseResult(await this.displayExec(command));
    if (options.takeScreenshot) {
      return await this.resultWithScreenshot(result);
    }

    return result;
  }

  private async displayExec(command: string) {
    return await this.vm.exec({
      command: `DISPLAY=${this.shellEscape(
        this.builder.options.display,
      )} ${command}`,
    });
  }

  private noVncPath(path: string, viewOnly: boolean): string {
    if (!viewOnly) {
      return path;
    }

    const url = new URL(path, "https://vnc.local");
    url.searchParams.set("view_only", "1");
    return `${url.pathname}${url.search}${url.hash}`;
  }

  private displayNumber(): number | null {
    const match = this.builder.options.display.match(/^:(\d+)(?:\.\d+)?$/);
    return match ? Number(match[1]) : null;
  }

  private validateCoordinate(
    coordinate: ComputerUseCoordinate,
  ): [number, number] {
    if (!Array.isArray(coordinate) || coordinate.length !== 2) {
      throw new Error(`${coordinate} must be a tuple of length 2.`);
    }

    const [x, y] = coordinate;
    this.validateNonNegativeInt(x, "coordinate[0]");
    this.validateNonNegativeInt(y, "coordinate[1]");
    return [x, y];
  }

  private validateRegion(
    region: ComputerUseRegion,
  ): [number, number, number, number] {
    if (!Array.isArray(region) || region.length !== 4) {
      throw new Error(`${region} must be a tuple of length 4.`);
    }

    const [x0, y0, x1, y1] = region;
    this.validateNonNegativeInt(x0, "region[0]");
    this.validateNonNegativeInt(y0, "region[1]");
    this.validateNonNegativeInt(x1, "region[2]");
    this.validateNonNegativeInt(y1, "region[3]");
    return [x0, y0, x1, y1];
  }

  private validateNonNegativeInt(value: number, name: string): number {
    if (!Number.isInteger(value) || value < 0) {
      throw new Error(`${name} must be a non-negative integer.`);
    }

    return value;
  }

  private validateDuration(duration: number): number {
    if (typeof duration !== "number" || !Number.isFinite(duration)) {
      throw new Error("duration must be a number.");
    }

    if (duration < 0) {
      throw new Error("duration must be non-negative.");
    }

    if (duration > 100) {
      throw new Error("duration is too long.");
    }

    return duration;
  }

  private clickButtonArg(action: ComputerUseAction["action"]): string {
    switch (action) {
      case "left_click":
        return "1";
      case "right_click":
        return "3";
      case "middle_click":
        return "2";
      case "double_click":
        return "--repeat 2 --delay 10 1";
      case "triple_click":
        return "--repeat 3 --delay 10 1";
      default:
        throw new Error(`Unsupported click action: ${action}`);
    }
  }

  private async resultWithScreenshot(
    result: ComputerUseActionResult,
  ): Promise<ComputerUseActionResult> {
    if (!result.success) {
      return result;
    }

    await this.sleep(COMPUTER_USE_SCREENSHOT_DELAY_MS);
    const screenshot = await this.screenshot();
    return {
      ...result,
      base64_image: screenshot.data,
    };
  }

  private toComputerUseResult(result: {
    statusCode?: number | null;
    stdout?: string | null;
    stderr?: string | null;
  }): ComputerUseActionResult {
    const stdout = result.stdout ?? undefined;
    const stderr = result.stderr ?? undefined;

    return {
      success: result.statusCode === 0,
      output: stdout,
      error: stderr,
      stdout,
      stderr,
    };
  }

  private async sleep(ms: number): Promise<void> {
    await new Promise((resolve) => setTimeout(resolve, ms));
  }

  private ensureHeaded(): void {
    if (this.builder.options.mode !== "headed") {
      throw new Error(
        "Chromium computer-use methods require VmChromium({ mode: \"headed\" }).",
      );
    }
  }

  private ensureVncEnabled(): void {
    if (!this.builder.options.enableVnc) {
      throw new Error(
        "Chromium VNC routing requires VmChromium({ mode: \"headed\", enableVnc: true }).",
      );
    }
  }

  private buttonNumber(button: ComputerUseMouseButton = "left"): number {
    switch (button) {
      case "left":
        return 1;
      case "middle":
        return 2;
      case "right":
        return 3;
    }
  }

  private freestyle(): Freestyle {
    // @ts-expect-error using internal Freestyle client from a VM instance
    return this.vm._freestyle;
  }

  private shellEscape(value: string): string {
    return `'${value.replace(/'/g, "'\\''")}'`;
  }
}
