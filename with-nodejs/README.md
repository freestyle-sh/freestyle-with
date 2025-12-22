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

## Documentation

- [Freestyle Documentation](https://docs.freestyle.sh)
- [Node.js Documentation](https://nodejs.org/docs)
- [NVM Documentation](https://github.com/nvm-sh/nvm)
