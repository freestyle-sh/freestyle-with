# @freestyle-sh/with-ruby

Ruby runtime via [RVM](https://rvm.io) for [Freestyle](https://freestyle.sh) VMs.

## Installation

```bash
npm install @freestyle-sh/with-ruby freestyle-sandboxes
```

## Usage

```typescript
import { freestyle } from "freestyle-sandboxes";
import { VmRuby } from "@freestyle-sh/with-ruby";

const { vm } = await freestyle.vms.create({
  with: {
    ruby: new VmRuby(),
  },
});

const res = await vm.ruby.runCode(
  "require 'json'; puts JSON.generate({ hello: 'world' })"
);

console.log(res);
// { result: { hello: 'world' }, stdout: '{"hello":"world"}\n', statusCode: 0 }
```

## Options

```typescript
new VmRuby({
  version: "3.3.6", // Optional: specific Ruby version (default: "3.4.8")
})
```

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `version` | `string` | `"3.4.8"` | Ruby version to install via RVM. |

## API

### `vm.ruby.runCode(code: string)`

Executes Ruby code in the RVM-managed Ruby runtime.

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
- [Ruby Documentation](https://www.ruby-lang.org/en/documentation/)
- [RVM Documentation](https://rvm.io)
