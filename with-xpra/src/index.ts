import type {
  DisplayBackendDefinition,
  DisplayBackendPorts,
  DisplayBackendReadyOptions,
  DisplayBackendRouteOptions,
  DisplayBackendRouteTarget,
  DisplayBackendService,
  DisplayBackendServiceOptions,
} from "@freestyle-sh/with-type-display";

export type {
  DisplayBackendCapabilities,
  DisplayBackendDefinition,
  DisplayBackendKind,
  DisplayBackendPorts,
  DisplayBackendReadyOptions,
  DisplayBackendRouteOptions,
  DisplayBackendRouteTarget,
  DisplayBackendScreen,
  DisplayBackendService,
  DisplayBackendServiceOptions,
  DisplayRoute,
  DisplayRouteOptions,
  DisplayTransport,
  VmDisplay,
  VmDisplayInstance,
} from "@freestyle-sh/with-type-display";

const DEFAULT_RUNTIME_DIR = "/tmp/freestyle-chromium-runtime";
const XPRA_APT_KEY = `-----BEGIN PGP PUBLIC KEY BLOCK-----

mQINBGSEpywBEACn1DbqO5RrpaA5EiEpXbNrPeaxGgy6v53DLlgPOsUc4MSoz8uN
Qw6n+yFPVjlWmk3nyhNdwZH2ImsKyYTvC7wt3Bn9IIvCuGmKC9xy6dd+fsCHf6m4
BYpVWBhhCixp291sBiQ+jYPhZ2Ch8DpAm92Lgqp2A/r6//Gz0jt/5i9NblHuiYZ+
achuyYGGp2tJpWG1A5/q0DpgMqq2pWNPu6+sh/iecMq992KCbzkyq/nTy9niYVvp
c6Ms7N5q25hYD6090M2gR2PtNv+SPssEv9kjQEIwoTheJXxZ/5uTPDKy/ymtsu4d
VTTMyubr4cZltW0q0WQWrgzcjVwbcbmMgl6ouzB1SIzvOBNodHZIuKnaLmqrZwGG
3wnM98RGYaotAj/BLdwXeBTLO5IgZSGI5YcwAREVBK0LUtKQj4Ypj7JTxv62XySr
wuuYuximxfSAmbiXuVsPe3Y6yQPUNZ+mkvYpkbS/zKxN7EVzwZsUDyNfwkWXc2bQ
BowSEyKYNMdR8SjdS0D1Gtc1QbVMd4mYuQqK3gz3SK4mBdePFBAUwjLbTwhZE92R
27hb3qNSQkYM9lCUqxyHKhAPpr/Xf+ZrKpqBJErU1ve0JQiuGMfQ3RUJeBJGSTes
gAHjfEYLLqrPtk0dZ566j6inlpqoKRcjWzM9oik4j0v65AwGOVNe59AjuwARAQAB
tBRYcHJhIDx4cHJhQHhwcmEub3JnPokCUgQTAQoAPBYhBLSZO1cyMUjjeXfl2HMl
TK0Xl4+vBQJkhKcsAhsDBQkSzAMABAsJCAcEFQoJCAUWAgMBAAIeBQIXgAAKCRBz
JUytF5ePr4TbD/9oP4stXK0LeQQtZindGc2VC4LxDL78KmDCYOEblGj3B8JS+3D6
m3E2NKAUlnKtgMQAMKKkpk9LNYwPr/H/0HBjpWmQgI9dJzvKZRAkCE23hdiCHv8y
qqrGJmrOsU5+vsozM9b/eh5UJw2klxVyGgZHAdmF73MfSAy26Wf9IArecVCf0lyC
CaF6rNCkNquvq2d58B6Wvn/DdVQgwS+UUfd557+EbWrIu2txPeROfYtEuMGc7dMD
C/fWMutx97+7sVPASrfPIFZ/WPHsPnyXbKqDYKu+1cWCwljp6PqOBArnAa4++elK
AQ2VeOkwnYplp0/aPkGqQSJ+bD5rYVMOKXkpsEDOFZs3a38F1lqFakRQlJPxv2qc
qHd/G6kkYRetX6ONqyqy32DJO6dEXKwZJGIr6/4bQ/u+eQVDi2JrHvjy6d/4VPTD
eoXP0hzH4Z42XycfymLQSP1TVgQ/Tw9svT277dqSUCH+a0n/JdWd+b/fF/5P9aU2
kTYpvcC/jxa1gsJIV4Bm7sQvVZuNKLnkYsLmSj59MdKqLLnOOIzUmEb7MbCeaFTb
7x6Ah5s6m1iefFh2rAiPMJzi7Mz1f3f7jWytFMzsgOZid5pjvg7jXxXiq8WXpCyv
nAMK2pOnzT1wXAfUBIPgs/0VEUBTxyOpcIM6tS7Ft34iLjGTexpMQyIeLw==
=Eg3Z
-----END PGP PUBLIC KEY BLOCK-----
`;
const XPRA_APT_SOURCE = `Types: deb
URIs: https://xpra.org
Suites: trixie
Components: main
Signed-By: /usr/share/keyrings/xpra.asc
Architectures: amd64 arm64
`;

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

export type XpraDisplayBackendOptions = {
  /** Command started inside the Xpra desktop session (default: openbox). */
  desktopCommand?: string;
  /** Runtime dir shared by Xpra, PulseAudio, and Chromium. */
  runtimeDir?: string;
  /**
   * Xpra display resize mode. `true` follows the HTML5 client viewport.
   * Pass a value like "1280x800" only when the client viewport is fixed too.
   */
  resizeDisplay?: boolean | string;
  /** Enable speaker/audio forwarding from the VM to the browser. */
  audio?: boolean;
  /** Enable microphone forwarding from the browser to the VM. */
  microphone?: boolean;
  /** Extra apt packages installed with Xpra. */
  extraAptDeps?: string[];
  /** Extra command-line flags appended to the xpra start-desktop command. */
  extraArgs?: string[];
};

export class XpraDisplayBackend implements DisplayBackendDefinition {
  name = "xpra" as const;
  kind = "xpra" as const;
  transport = "xpra-html5" as const;
  ownsDisplay = true;
  capabilities;
  aptDeps;
  installCheck;
  additionalFiles;
  private readonly desktopCommand: string;
  private readonly runtimeDir: string;
  private readonly resizeDisplay: string;
  private readonly audio: boolean;
  private readonly microphone: boolean;
  private readonly extraArgs: string[];

  constructor(options: XpraDisplayBackendOptions = {}) {
    this.desktopCommand = options.desktopCommand ?? "openbox";
    this.runtimeDir = options.runtimeDir ?? DEFAULT_RUNTIME_DIR;
    this.resizeDisplay =
      typeof options.resizeDisplay === "string"
        ? options.resizeDisplay
        : options.resizeDisplay === false
          ? "no"
          : "yes";
    this.audio = options.audio ?? true;
    this.microphone = options.microphone ?? false;
    this.extraArgs = options.extraArgs ?? [];
    this.capabilities = {
      audio: this.audio,
      clipboard: true,
      fileTransfer: true,
      fullDesktop: true,
      microphone: this.microphone,
      rootless: false,
      viewOnly: false,
    };
    const audioAptDeps =
      this.audio || this.microphone
        ? ["xpra-audio-server"]
        : [];
    this.aptDeps = [
      "dbus-x11",
      "openbox",
      "xpra-codecs",
      "xpra-html5",
      "xpra-server",
      "xpra-x11",
      ...audioAptDeps,
      ...(options.extraAptDeps ?? []),
    ];
    this.installCheck = [
      "command -v xpra",
      "command -v openbox",
      ...(this.audio || this.microphone
        ? ["command -v pulseaudio", "command -v pactl"]
        : []),
      "xpra --version",
    ].join("\n");
    const extraArgs = this.extraArgs
      .map((arg) => `  ${shellEscape(arg)}`)
      .join("\n");
    const pulseSetup =
      this.audio || this.microphone
        ? `
pulse_socket="${this.pulseSocket()}"
mkdir -p "$XDG_RUNTIME_DIR/pulse"
mkdir -p "$HOME/.config/pulse"
pulseaudio --kill >/dev/null 2>&1 || true
rm -f "$pulse_socket"
pulseaudio \\
  -n \\
  --daemonize=false \\
  --exit-idle-time=-1 \\
  --use-pid-file=false \\
  --high-priority=false \\
  --realtime=false \\
  --log-target=stderr \\
  --load="module-null-sink sink_name=Xpra-Speaker sink_properties=device.description=Xpra-Speaker" \\
  --load="module-native-protocol-unix socket=$pulse_socket auth-anonymous=1" &
pulse_pid="$!"
for attempt in {1..60}; do
  if [[ -S "$pulse_socket" ]]; then
    break
  fi
  if ! kill -0 "$pulse_pid" >/dev/null 2>&1; then
    wait "$pulse_pid"
  fi
  sleep 1
done
if [[ ! -S "$pulse_socket" ]]; then
  echo "PulseAudio did not create $pulse_socket" >&2
  exit 1
fi
export PULSE_SERVER="unix:$pulse_socket"
`
        : "";
    this.additionalFiles = {
      "/usr/share/keyrings/xpra.asc": {
        content: XPRA_APT_KEY,
      },
      "/etc/apt/sources.list.d/xpra.sources": {
        content: XPRA_APT_SOURCE,
      },
      "/opt/freestyle-xpra-start.sh": {
        content: `#!/bin/bash
set -euo pipefail

display="$1"
web_port="$2"
desktop_command="$3"

export HOME="\${HOME:-/root}"
export XDG_RUNTIME_DIR="${this.runtimeDir}"

mkdir -p "$XDG_RUNTIME_DIR" "$HOME/.xpra"
chmod 700 "$XDG_RUNTIME_DIR"
${pulseSetup}

args=(
  start-desktop "$display"
  --daemon=no
  --bind-tcp=0.0.0.0:"$web_port"
  --auth=allow
  --html=on
  --mdns=no
  --webcam=no
  --speaker=${this.audio ? "on" : "off"}
  --microphone=${this.microphone ? "on" : "off"}
  --pulseaudio=no
  --audio-source=pulse
  --resize-display=${shellEscape(this.resizeDisplay)}
  --start="$desktop_command"
${extraArgs}
)

exec xpra "\${args[@]}"
`,
      },
    };
  }

  readyServiceName(options: DisplayBackendReadyOptions): string {
    return `${options.servicePrefix}-xpra.service`;
  }

  applicationEnv(options: DisplayBackendReadyOptions): Record<string, string> {
    return {
      XDG_RUNTIME_DIR: this.runtimeDir,
      ...(this.audio || this.microphone
        ? { PULSE_SERVER: `unix:${this.pulseSocket()}` }
        : {}),
    };
  }

  services(options: DisplayBackendServiceOptions): DisplayBackendService[] {
    const webPort = requirePort(options.ports, "web");

    return [
      {
        name: `${options.servicePrefix}-xpra`,
        exec: [
          "bash",
          "/opt/freestyle-xpra-start.sh",
          shellEscape(options.display),
          String(webPort),
          shellEscape(this.desktopCommand),
        ].join(" "),
        after: ["install-chromium.service"],
        requires: ["install-chromium.service"],
        env: {
          HOME: options.user === "root" ? "/root" : `/home/${options.user}`,
          XDG_RUNTIME_DIR: this.runtimeDir,
        },
        user: options.user,
      },
    ];
  }

  routeTarget(
    options: DisplayBackendRouteOptions,
  ): DisplayBackendRouteTarget {
    if (options.viewOnly) {
      throw new Error("XpraDisplayBackend does not support server-enforced view-only routes yet.");
    }

    return {
      path: options.path ?? "/",
      port: requirePort(options.ports, "web"),
      viewOnly: false,
    };
  }

  private pulseSocket(): string {
    return `${this.runtimeDir}/pulse/native`;
  }
}
