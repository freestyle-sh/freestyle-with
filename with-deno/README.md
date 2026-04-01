# @freestyle-sh/with-deno

Deno runtime for [Freestyle](https://freestyle.sh) VMs.

## Installation

```bash
npm install @freestyle-sh/with-deno freestyle-sandboxes
```

## Usage

```typescript
import { freestyle, VmSpec } from "freestyle-sandboxes";
import { VmDeno } from "@freestyle-sh/with-deno";

const spec = new VmSpec({
  with: {
    deno: new VmDeno(),
  },
});

const { vm } = await freestyle.vms.create({ spec });

const res = await vm.deno.runCode({
  code: "console.log(JSON.stringify({ hello: 'world', runtime: 'deno' }));",
});

console.log(res);
// { result: { hello: 'world', runtime: 'deno' }, stdout: '{"hello":"world","runtime":"deno"}\n', statusCode: 0 }
```

## Options

```typescript
new VmDeno({
  version: "2.0.0",  // Optional: specific Deno version (default: latest)
})
```

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `version` | `string` | `undefined` | Deno version to install. If not specified, installs the latest version. |

## API

### `vm.deno.runCode({ code: string })`

Executes JavaScript/TypeScript code using `deno eval`.

**Returns:** `Promise<RunCodeResponse>`

```typescript
type RunCodeResponse<Result> = {
  result: Result;      // Parsed JSON from stdout (if valid JSON)
  stdout?: string;     // Raw stdout output
  stderr?: string;     // Raw stderr output
  statusCode?: number; // Exit code
};
```

### `vm.deno.install(options?)`

Installs packages using Deno. Supports both npm packages and JSR (Deno's native registry).

```typescript
// Install from deno.json in current directory
await vm.deno.install();

// Install from deno.json in specific directory
await vm.deno.install({ directory: "/app" });

// Install npm packages (auto-prefixed with npm:)
await vm.deno.install({ deps: ["lodash-es", "express"] });

// Install JSR packages (use jsr: prefix)
await vm.deno.install({ deps: ["jsr:@std/path", "jsr:@std/fs"] });

// Install with specific versions
await vm.deno.install({ deps: { "lodash-es": "^4.0.0" } });

// Install as dev dependencies
await vm.deno.install({ deps: ["typescript"], dev: true });

// Install globally
await vm.deno.install({ global: true, deps: ["jsr:@std/cli"] });
```

**Returns:** `Promise<InstallResult>`

```typescript
type InstallResult = {
  success: boolean;
  stdout?: string;
  stderr?: string;
};
```

## JSR Packages

Deno has native support for [JSR](https://jsr.io) (JavaScript Registry), which hosts TypeScript-first packages including the Deno standard library.

```typescript
// Install @std/path from JSR
await vm.deno.install({ deps: ["jsr:@std/path"] });

// Use it in code
const res = await vm.deno.runCode({
  code: `
    import * as path from "jsr:@std/path";
    console.log(JSON.stringify({
      join: path.join("foo", "bar", "baz"),
      basename: path.basename("/home/user/file.txt"),
    }));
  `,
});
```

## Documentation

- [Freestyle Documentation](https://docs.freestyle.sh)
- [Deno Documentation](https://docs.deno.com)
- [JSR Registry](https://jsr.io)
