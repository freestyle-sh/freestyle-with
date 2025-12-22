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

## Documentation

- [Freestyle Documentation](https://docs.freestyle.sh)
- [Bun Documentation](https://bun.sh/docs)

