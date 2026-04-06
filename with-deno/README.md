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

const deno = new VmDeno();
const spec = new VmSpec().with("deno", deno);

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
const deno = new VmDeno();
const spec = new VmSpec().with("deno", deno);
const { vm } = await freestyle.vms.create({ spec });

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

## Workspaces and Tasks

Use the Deno builder to attach a workspace and run a Deno task as a managed systemd service.

```typescript
import { Freestyle, VmSpec } from "freestyle-sandboxes";
import { VmDeno } from "@freestyle-sh/with-deno";

const freestyle = new Freestyle();

const deno = new VmDeno();
const workspace = deno.workspace({ path: "/root/app", install: true });
const appTask = workspace.task("start", {
  env: {
    HOST: "0.0.0.0",
  },
});

const spec = new VmSpec()
  .with("deno", deno)
  .repo("https://github.com/deco-sites/storefront", "/root/app")
  .with("workspace", workspace)
  .with("app", appTask)
  .snapshot()
  .waitFor("curl http://localhost:8000")
  .snapshot();

const { repoId } = await freestyle.git.repos.create({
  source: {
    url: "https://github.com/deco-sites/storefront",
  },
});

const domain = `${crypto.randomUUID()}.style.dev`;

const { vm } = await freestyle.vms.create({
  spec,
  domains: [{ domain, vmPort: 8000 }],
  git: {
    repos: [{ repo: repoId, path: "/root/app" }],
  },
});

// Task instance comes from .with("app", appTask)
const recentLogs = await vm.app.logs();
console.log(recentLogs);
```

### Workspace API

```typescript
const workspace = deno.workspace({
  path: "/root/app",
  install: true,
});
```

- `path`: Working directory for `deno install` and task execution.
- `install`: When true, runs `deno install` in the workspace during VM startup.

### Task API

```typescript
const task = workspace.task("start", {
  env: { HOST: "0.0.0.0" },
  serviceName: "my-deno-app",
});
```

- `name`: Task name from `deno.json`.
- `env`: Optional environment variables for the task service.
- `serviceName`: Optional explicit systemd service name.

When added to the spec with `.with("app", task)`, you can access task logs with `vm.app.logs()`.

## Documentation

- [Freestyle Documentation](https://docs.freestyle.sh)
- [Deno Documentation](https://docs.deno.com)
- [JSR Registry](https://jsr.io)
