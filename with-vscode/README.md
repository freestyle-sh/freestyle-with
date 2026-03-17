# @freestyle-sh/with-vscode

[VS Code](https://github.com/coder/code-server) in the browser for [Freestyle](https://freestyle.sh) VMs, powered by code-server.

## Installation

```bash
npm install @freestyle-sh/with-vscode freestyle-sandboxes
```

## Usage

```typescript
import { freestyle, VmSpec } from "freestyle-sandboxes";
import { VmVscode } from "@freestyle-sh/with-vscode";

const domain = `${crypto.randomUUID()}.style.dev`;

const { vm } = await freestyle.vms.create({
  snapshot: new VmSpec({
    with: {
      vscode: new VmVscode(),
    },
  }),
  domains: [
    {
      domain,
      vmPort: 8080,
    },
  ],
});

console.log(`VS Code available at: https://${domain}`);
```

### With Extensions

```typescript
const { vm } = await freestyle.vms.create({
  snapshot: new VmSpec({
    with: {
      vscode: new VmVscode({
        workdir: "/root/project",
        extensions: ["esbenp.prettier-vscode", "dbaeumer.vscode-eslint"],
      }),
    },
  }),
  domains: [
    {
      domain,
      vmPort: 8080,
    },
  ],
});
```

## Options

```typescript
new VmVscode({
  port: 8080,              // Optional: port to run on (default: 8080)
  workdir: "/root",        // Optional: folder to open (default: /root)
  user: "root",            // Optional: user to run as (default: root)
  extensions: [],          // Optional: VS Code extensions to pre-install
})
```

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `port` | `number` | `8080` | Port to run code-server on |
| `workdir` | `string` | `"/root"` | Folder to open in VS Code |
| `user` | `string` | `"root"` | User to run code-server as |
| `extensions` | `string[]` | `[]` | VS Code extensions to pre-install (e.g. `["esbenp.prettier-vscode"]`) |

## API

### `vm.vscode.route({ domain })`

Expose code-server publicly via Freestyle domain routing.

```typescript
await vm.vscode.route({ domain: "my-editor.example.com" });
```

### `vm.vscode.port`

Returns the configured port number.

## How It Works

The package uses systemd services to install and run code-server during VM creation:

1. Downloads code-server v4.100.3 from GitHub releases
2. Installs any specified VS Code extensions
3. Starts code-server as a systemd service with auto-restart

Authentication is disabled by default. Code-server listens on all interfaces (0.0.0.0).

## Documentation

- [Freestyle Documentation](https://docs.freestyle.sh)
- [code-server Documentation](https://coder.com/docs/code-server)
