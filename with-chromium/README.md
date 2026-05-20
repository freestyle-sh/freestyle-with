# @freestyle-sh/with-chromium

Chromium for [Freestyle](https://freestyle.sh) VMs with Chrome DevTools Protocol, headed desktop mode, noVNC routing, and simple computer-use actions.

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

const vnc = await vm.chromium.routeVnc();
console.log(vnc.url);

const watch = await vm.chromium.routeVnc({ viewOnly: true });
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
| `enableVnc` | `boolean` | `true` in headed mode | Start a VNC backend and noVNC services. |
| `vncBackend` | `VncBackendDefinition` | `new TigerVncBackend()` | VNC backend implementation. Use `new X11VncBackend()` to opt into x11vnc. |
| `vncPort` | `number` | `5900` | Raw VNC port inside the VM. |
| `vncViewOnlyPort` | `number` | `vncPort + 1` | Server-enforced view-only VNC port inside the VM. |
| `noVncPort` | `number` | `6080` | HTTP noVNC port used for Freestyle domain routing. |
| `noVncViewOnlyPort` | `number` | `noVncPort + 1` | HTTP noVNC port for view-only Freestyle routing. |

## API

### Browser/CDP

- `vm.chromium.cdpPort()`
- `vm.chromium.cdpRoutePort()`
- `vm.chromium.route({ domain? })`
- `vm.chromium.cdpJsonVersion()`
- `vm.chromium.browserWSEndpoint({ route?, domain? })`

### VNC

- `vm.chromium.vncPort()`
- `vm.chromium.noVncPort()`
- `vm.chromium.routeVnc({ domain?, path?, viewOnly? })`

Chromium uses TigerVNC by default for headed VNC sessions. `routeVnc()` returns
the default interactive noVNC route. `routeVnc({ viewOnly: true })` routes a
separate server-enforced view-only VNC service.

VNC backends are pluggable objects with `name`, `aptDeps`, `installCheck`, and
`command()` fields. To override the default backend, import one from
`@freestyle-sh/with-vnc`:

```typescript
import { X11VncBackend } from "@freestyle-sh/with-vnc";

new VmChromium({
  mode: "headed",
  vncBackend: new X11VncBackend(),
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
