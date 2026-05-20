# @freestyle-sh/with-chromium

Chromium for [Freestyle](https://freestyle.sh) VMs with Chrome DevTools Protocol, headed desktop mode, display routing, VNC/noVNC support, and simple computer-use actions.

## Installation

```bash
npm install @freestyle-sh/with-chromium freestyle
```

## Headed Chromium With VNC

```typescript
import { freestyle, VmSpec } from "freestyle";
import { VmChromium } from "@freestyle-sh/with-chromium";

const { vm } = await freestyle.vms.create(
  new VmSpec({
    with: {
      chromium: new VmChromium({ mode: "headed" }),
    },
  }),
);

const display = await vm.chromium.routeDisplay();
console.log(display.url);

const watch = await vm.chromium.routeDisplay({ viewOnly: true });
console.log(watch.url);

const tool = await vm.chromium.computerUseTool();
const result = await vm.chromium.computerUse({
  action: "left_click",
  coordinate: [240, 180],
});
console.log(tool, Boolean(result.base64_image));
```

## Headless Chromium With CDP

```typescript
const { vm } = await freestyle.vms.create(
  new VmSpec({
    with: {
      chromium: new VmChromium({ mode: "headless" }),
    },
  }),
);

const ws = await vm.chromium.browserWSEndpoint({ route: true });
console.log(ws);
```

## Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `mode` | `"headless" \| "headed"` | `"headless"` | Native Chromium headless mode or an X11 desktop. |
| `cdpPort` | `number` | `9222` | Chrome DevTools Protocol port. |
| `cdpRoutePort` | `number` | `cdpPort + 1` | Internal proxy port used for public CDP routing. |
| `display` | `string` | `":99"` | X11 display for headed mode. |
| `screen` | `{ width?: number; height?: number; depth?: number }` | `1280x720x24` | Virtual display size. |
| `homepage` | `string` | `"about:blank"` | Page opened at startup. |
| `extraArgs` | `string[]` | `[]` | Additional Chromium command-line flags. |
| `enableDisplay` | `boolean` | `true` in headed mode | Start the configured display backend. |
| `displayBackend` | `DisplayBackendDefinition` | `new NoVncDisplayBackend({ vncBackend: new TigerVncBackend() })` | Display backend exposed by `routeDisplay()`. |
| `displayPorts` | `Record<string, number>` | `{ vnc: 5900, vncViewOnly: 5901, web: 6080, webViewOnly: 6081 }` | Named internal ports supplied to the display backend. |

## API

### Browser/CDP

- `vm.chromium.cdpPort()`
- `vm.chromium.cdpRoutePort()`
- `vm.chromium.route({ domain? })`
- `vm.chromium.cdpJsonVersion()`
- `vm.chromium.browserWSEndpoint({ route?, domain? })`

### Display

- `vm.chromium.displayPorts()`
- `vm.chromium.routeDisplay({ domain?, path?, viewOnly? })`

Display backends describe the web transport, system services, routes, and
capabilities for a headed session. The default display backend is noVNC over
TigerVNC:

```typescript
import { NoVncDisplayBackend, X11VncBackend } from "@freestyle-sh/with-vnc";

new VmChromium({
  mode: "headed",
  displayBackend: new NoVncDisplayBackend({
    vncBackend: new X11VncBackend(),
  }),
});
```

`routeDisplay()` returns `kind`, `transport`, and `capabilities`, so future
backends like Xpra or WebRTC can expose audio support without changing the
consumer route shape. noVNC routes currently report `audio: false`.

For audio, use the Xpra display backend:

```typescript
import { XpraDisplayBackend } from "@freestyle-sh/with-xpra";

new VmChromium({
  mode: "headed",
  user: "browser",
  displayBackend: new XpraDisplayBackend(),
  extraArgs: ["--autoplay-policy=no-user-gesture-required"],
});
```

Xpra owns the desktop session and sets the PulseAudio environment used by
Chromium. Install `@freestyle-sh/with-xpra` alongside `with-chromium`; its
route reports `transport: "xpra-html5"` and `audio: true`. Use a regular VM
user for this backend; PulseAudio is not reliable when Xpra runs as root.
This is the display backend to use when audio matters, but its HTML5 client can
have imperfect mouse alignment in some browser viewport and scaling states.
Prefer the default noVNC display backend for workflows that need precise pointer
interaction and do not need audio. Pass
`new XpraDisplayBackend({ resizeDisplay: "1280x800" })` only for fixed-viewport
setups; fixed display sizes can make pointer alignment worse if the web client
scales the canvas.

### VNC Display Backends

Chromium uses TigerVNC through noVNC by default for headed display sessions.
`routeDisplay()` returns the default interactive noVNC route.
`routeDisplay({ viewOnly: true })` routes a separate server-enforced
view-only noVNC service.

VNC backends are pluggable objects with `name`, `aptDeps`, `installCheck`, and
`command()` fields. Wrap them in `NoVncDisplayBackend` to use them as Chromium
display backends:

```typescript
import { NoVncDisplayBackend, X11VncBackend } from "@freestyle-sh/with-vnc";

new VmChromium({
  mode: "headed",
  displayBackend: new NoVncDisplayBackend({
    vncBackend: new X11VncBackend(),
  }),
});
```

### Computer Use

Headed mode supports:

- `vm.chromium.computerUseTool({ type?, enable_zoom? })`
- `vm.chromium.computerUse(action)`
- `vm.chromium.screenshot({ path? })`
- `vm.chromium.click({ x, y, button? })`
- `vm.chromium.doubleClick({ x, y, button?, delayMs? })`
- `vm.chromium.move({ x, y })`
- `vm.chromium.drag({ from, to, button? })`
- `vm.chromium.scroll({ x?, y?, deltaX?, deltaY? })`
- `vm.chromium.type({ text, delayMs? })`
- `vm.chromium.key({ keys })`

`computerUseTool()` returns an Anthropic-compatible `computer_20251124`
definition by default, including `display_width_px`, `display_height_px`,
`display_number`, and `enable_zoom`. `computerUse(action)` accepts the
Anthropic computer-use actions: `screenshot`, `cursor_position`, `mouse_move`,
`left_click`, `right_click`, `middle_click`, `double_click`, `triple_click`,
`left_click_drag`, `left_mouse_down`, `left_mouse_up`, `scroll`, `hold_key`,
`wait`, `type`, `key`, and `zoom`.

Screenshots are returned as PNG base64 strings. The convenience screenshot API
returns dimensions and MIME type:

```typescript
const screenshot = await vm.chromium.screenshot();

console.log(screenshot.mimeType); // "image/png"
console.log(screenshot.width, screenshot.height);
console.log(screenshot.data); // base64 PNG, without a data: URL prefix
```

To write the screenshot on the caller side:

```typescript
import { writeFile } from "node:fs/promises";

const screenshot = await vm.chromium.screenshot();
await writeFile("screenshot.png", Buffer.from(screenshot.data, "base64"));
```

To use the Anthropic-style action API:

```typescript
const result = await vm.chromium.computerUse({ action: "screenshot" });

if (result.base64_image) {
  await writeFile("screenshot.png", Buffer.from(result.base64_image, "base64"));
}
```

`screenshot({ path })` also writes the PNG inside the VM at `path` while still
returning the base64 PNG to the caller.
