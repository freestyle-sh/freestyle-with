# @freestyle-sh/with-bun

Bun runtime for [Freestyle](https://freestyle.sh) VMs.

## Installation

```bash
npm install @freestyle-sh/with-bun freestyle-sandboxes
```

## Usage

```typescript
import { freestyle } from "freestyle-sandboxes";
import { VmBun } from "@freestyle-sh/with-bun";

const { vm } = await freestyle.vms.create({
  with: {
    js: new VmBun(),
  },
});

const res = await vm.js.runCode({
  code: "console.log(JSON.stringify({ hello: 'world' }));"
});

console.log(res);
// { result: { hello: 'world' }, stdout: '{"hello":"world"}\n', statusCode: 0 }
```

## Options

```typescript
new VmBun({
  version: "1.1.0",  // Optional: specific Bun version (default: latest)
})
```

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `version` | `string` | `undefined` | Bun version to install. If not specified, installs the latest version. |

## API

### `vm.js.runCode({ code: string })`

Executes JavaScript/TypeScript code in the Bun runtime.

**Returns:** `Promise<RunCodeResponse>`

```typescript
type RunCodeResponse<Result> = {
  result: Result;      // Parsed JSON from stdout (if valid JSON)
  stdout?: string;     // Raw stdout output
  stderr?: string;     // Raw stderr output
  statusCode?: number; // Exit code
};
```

### `vm.js.install(options?)`

Installs npm packages using Bun.

```typescript
// Install from package.json in current directory
await vm.js.install();

// Install from package.json in specific directory
await vm.js.install({ directory: "/app" });

// Install specific packages
await vm.js.install({ deps: ["lodash", "express"] });

// Install with specific versions
await vm.js.install({ deps: { "lodash": "^4.0.0", "express": "~5.0.0" } });

// Install as dev dependencies
await vm.js.install({ deps: ["typescript"], dev: true });

// Install globally
await vm.js.install({ global: true, deps: ["typescript"] });
```

**Returns:** `Promise<InstallResult>`

```typescript
type InstallResult = {
  success: boolean;
  stdout?: string;
  stderr?: string;
};
```

## Workspaces and Tasks

Use the Bun builder to attach a workspace and run a package script as a managed systemd service.

```typescript
import { freestyle, VmSpec } from "freestyle-sandboxes";
import { VmBun } from "@freestyle-sh/with-bun";

const SOURCE_REPO = "https://github.com/freestyle-sh/freestyle-next";

const bun = new VmBun();
const workspace = bun.workspace({ path: "/root/app", install: true });
const appTask = workspace.task("dev", {
  env: {
    HOST: "0.0.0.0",
    PORT: "3000",
  },
});

const spec = new VmSpec()
  .with("bun", bun)
  .repo(SOURCE_REPO, "/root/app")
  .with("workspace", workspace)
  .with("app", appTask)
  .snapshot()
  .waitFor("curl http://localhost:3000")
  .snapshot();

const { repoId } = await freestyle.git.repos.create({
  source: {
    url: SOURCE_REPO,
  },
});

const domain = `${repoId}.style.dev`;

const { vm } = await freestyle.vms.create({
  spec,
  domains: [{ domain, vmPort: 3000 }],
  git: {
    repos: [{ repo: repoId, path: "/root/app" }],
  },
});

console.log(await vm.app.logs());
```

### Workspace API

```typescript
const workspace = bun.workspace({
  path: "/root/app",
  install: true,
});
```

- `path`: Working directory for `bun install` and task execution.
- `install`: When true, runs `bun install` in the workspace during VM startup.

### Task API

```typescript
const task = workspace.task("dev", {
  env: {
    HOST: "0.0.0.0",
    PORT: "3000",
  },
  serviceName: "my-bun-app",
});
```

- `name`: Script name from `package.json`.
- `env`: Optional environment variables for the task service.
- `serviceName`: Optional explicit systemd service name.

When added to the spec with `.with("app", task)`, you can access task logs with `vm.app.logs()`.

## Documentation

- [Freestyle Documentation](https://docs.freestyle.sh)
- [Bun Documentation](https://bun.sh/docs)

