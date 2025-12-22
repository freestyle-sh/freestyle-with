# @freestyle-sh/with-uv

Python runtime via [uv](https://github.com/astral-sh/uv) for [Freestyle](https://freestyle.sh) VMs.

## Installation

```bash
npm install @freestyle-sh/with-uv freestyle-sandboxes
```

## Usage

```typescript
import { freestyle } from "freestyle-sandboxes";
import { VmUv } from "@freestyle-sh/with-uv";

const { vm } = await freestyle.vms.create({
  with: {
    uv: new VmUv(),
  },
});

const res = await vm.uv.runCode(
  "import json; print(json.dumps({ 'hello': 'world' }))"
);

console.log(res);
// { result: { hello: 'world' }, stdout: '{"hello": "world"}\n', statusCode: 0 }
```

## Options

```typescript
new VmUv({
  version: "0.5.0",      // Optional: specific uv version
  pythonVersion: "3.13", // Optional: Python version (default: "3.14")
})
```

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `version` | `string` | `undefined` | uv version to install. If not specified, installs the latest version. |
| `pythonVersion` | `string` | `"3.14"` | Python version to install via uv. |

## API

### `vm.uv.runCode(code: string)`

Executes Python code using uv's managed Python runtime.

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
- [uv Documentation](https://docs.astral.sh/uv/)
