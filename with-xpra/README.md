# @freestyle-sh/with-xpra

Xpra HTML5 display backend for Freestyle VM packages. This is the display
backend to use when the browser session needs audio.

## Usage

```typescript
import { XpraDisplayBackend } from "@freestyle-sh/with-xpra";

new XpraDisplayBackend({
  audio: true,
});
```

The backend starts an Xpra desktop session with the built-in HTML5 client,
PulseAudio speaker forwarding, and a shared runtime directory for applications
that need to emit audio. Audio is enabled by default.
The virtual display follows the HTML5 client viewport by default.

```typescript
new VmChromium({
  mode: "headed",
  user: "browser",
  displayBackend: new XpraDisplayBackend(),
  extraArgs: ["--autoplay-policy=no-user-gesture-required"],
});
```

`routeDisplay()` returns an Xpra HTML5 URL with `transport: "xpra-html5"` and
`capabilities.audio: true`. `viewOnly` routes are not supported yet because the
current backend does not start a separate server-enforced read-only transport.
Run Xpra and the application as a regular VM user; PulseAudio is not reliable
when the desktop session runs as root.

## Known Limitations

Use this backend when audio matters. The Xpra HTML5 client can have imperfect
mouse alignment in some browser viewport and scaling states; the pointer may
feel slightly shifted from the visible target. Prefer the default noVNC display
backend for workflows that need precise pointer interaction and do not need
audio.

If you need a fixed virtual display, pass Xpra's resize value explicitly:

```typescript
new XpraDisplayBackend({
  resizeDisplay: "1280x800",
});
```

Only use a fixed size when the browser viewport is fixed too; otherwise the
HTML5 client may scale the canvas and make pointer alignment worse.

The backend adds the official Xpra apt repository as a spec file and uses
`aptDeps` for install packages, including `xpra-server`, `xpra-html5`,
`xpra-audio-server`, `xpra-x11`, and `xpra-codecs`.
