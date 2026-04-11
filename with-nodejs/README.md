# @freestyle-sh/with-nodejs

Node.js runtime via [NVM](https://github.com/nvm-sh/nvm) for [Freestyle](https://freestyle.sh) VMs.

## Installation

```bash
npm install @freestyle-sh/with-nodejs freestyle-sandboxes
```

## Usage

```typescript
import { freestyle } from "freestyle-sandboxes";
import { VmNodeJs } from "@freestyle-sh/with-nodejs";

const { vm } = await freestyle.vms.create({
  with: {
    node: new VmNodeJs(),
  },
});

const res = await vm.node.runCode({
  code: "console.log(JSON.stringify({ hello: 'world' }));"
});

console.log(res);
// { result: { hello: 'world' }, stdout: '{"hello":"world"}\n', statusCode: 0 }
```

## Options

```typescript
new VmNodeJs({
  version: "22", // Optional: Node.js version (default: "24")
})
```

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `version` | `string` | `"24"` | Node.js version to install via NVM. |

## API

### `vm.node.runCode({ code: string })`

Executes JavaScript code in the Node.js runtime.

**Returns:** `Promise<RunCodeResponse>`

```typescript
type RunCodeResponse<Result> = {
  result: Result;      // Parsed JSON from stdout (if valid JSON)
  stdout?: string;     // Raw stdout output
  stderr?: string;     // Raw stderr output
  statusCode?: number; // Exit code
};
```

### `vm.node.install(options?)`

Installs npm packages.

```typescript
// Install from package.json in current directory
await vm.node.install();

// Install from package.json in specific directory
await vm.node.install({ directory: "/app" });

// Install specific packages
await vm.node.install({ deps: ["lodash", "express"] });

// Install with specific versions
await vm.node.install({ deps: { "lodash": "^4.0.0", "express": "~5.0.0" } });

// Install as dev dependencies
await vm.node.install({ deps: ["typescript"], dev: true });

// Install globally
await vm.node.install({ global: true, deps: ["typescript"] });
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

Use the Node.js builder to attach a workspace and run an npm script as a managed systemd service.

```typescript
import { freestyle, VmSpec } from "freestyle-sandboxes";
import { VmNodeJs } from "@freestyle-sh/with-nodejs";

const SOURCE_REPO = "https://github.com/freestyle-sh/freestyle-next";

const node = new VmNodeJs();
const workspace = node.workspace({ path: "/root/app", install: true });
const appTask = workspace.task("dev", {
  env: {
    HOST: "0.0.0.0",
    PORT: "3000",
  },
});

const spec = new VmSpec()
  .with("node", node)
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
const workspace = node.workspace({
  path: "/root/app",
  install: true,
});
```

- `path`: Working directory for `npm install` and task execution.
- `install`: When true, runs `npm install` in the workspace during VM startup.

### Task API

```typescript
const task = workspace.task("dev", {
  env: {
    HOST: "0.0.0.0",
    PORT: "3000",
  },
  serviceName: "my-node-app",
});
```

- `name`: Script name from `package.json`.
- `env`: Optional environment variables for the task service.
- `serviceName`: Optional explicit systemd service name.

When added to the spec with `.with("app", task)`, you can access task logs with `vm.app.logs()`.

## Documentation

- [Freestyle Documentation](https://docs.freestyle.sh)
- [Node.js Documentation](https://nodejs.org/docs)
- [NVM Documentation](https://github.com/nvm-sh/nvm)
