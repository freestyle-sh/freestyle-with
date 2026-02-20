# @freestyle-sh/with-playwright

Playwright runtime for [Freestyle](https://freestyle.sh) VMs, including browser installs.

## Installation

```bash
npm install @freestyle-sh/with-playwright freestyle-sandboxes
```

## Usage

```typescript
import { freestyle } from "freestyle-sandboxes";
import { VmPlaywright } from "@freestyle-sh/with-playwright";

const { vm } = await freestyle.vms.create({
  with: {
    playwright: new VmPlaywright(),
  },
});

const res = await vm.playwright.runCode({
  code: `
  const { chromium } = require("playwright");
  (async () => {
    const browser = await chromium.launch();
    const page = await browser.newPage();
    await page.goto("https://example.com");
    const title = await page.title();
    await browser.close();
    console.log(JSON.stringify({ title }));
  })();
  `,
});

console.log(res);
```

## Options

```typescript
new VmPlaywright({
  nodeVersion: "24",
  playwrightVersion: "1.47.0",
  installDeps: true,
  browsers: ["chromium"],
})
```

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `nodeVersion` | `string` | `"24"` | Node.js version to install via NVM. |
| `playwrightVersion` | `string` | `undefined` | Playwright version to install. |
| `installDeps` | `boolean` | `true` | Install Playwright system dependencies via `--with-deps`. |
| `browsers` | `("chromium" \| "firefox" \| "webkit")[]` | `undefined` | Limit browser installs; default installs all. |

## API

### `vm.playwright.runCode({ code: string })`

Executes JavaScript code in the Playwright-ready Node.js runtime.

**Returns:** `Promise<RunCodeResponse>`

```typescript
type RunCodeResponse<Result> = {
  result: Result;
  stdout?: string;
  stderr?: string;
  statusCode?: number;
};
```

### `vm.playwright.install(options?)`

Installs npm packages with `npm install`.

```typescript
await vm.playwright.install({ deps: ["@playwright/test"] });
```

**Returns:** `Promise<InstallResult>`

```typescript
type InstallResult = {
  success: boolean;
  stdout?: string;
  stderr?: string;
};
```

## Documentation

- [Freestyle Documentation](https://docs.freestyle.sh)
- [Playwright Documentation](https://playwright.dev)
```
