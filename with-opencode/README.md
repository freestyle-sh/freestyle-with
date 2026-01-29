# @freestyle-sh/with-opencode

[OpenCode](https://opencode.ai) integration for [Freestyle](https://freestyle.sh) VMs. Provides a fully configured OpenCode AI coding assistant server in your Freestyle VM.

## Installation

```bash
bun add @freestyle-sh/with-opencode freestyle-sandboxes
```

## Usage

### Basic Setup

```typescript
import { freestyle, VmSpec } from "freestyle-sandboxes";
import { VmOpenCode } from "@freestyle-sh/with-opencode";

const { vm } = await freestyle.vms.create({
  spec: new VmSpec({
    with: {
      opencode: new VmOpenCode(),
    },
  }),
});

// Expose the web UI
const { url } = await vm.opencode.routeWeb();
console.log(`OpenCode UI: ${url}`);
```

### Using the API Client

```typescript
const { client } = await vm.opencode.client();

// Use the OpenCode SDK client to interact with the server
const sessions = await client.session.list();
```

### With Custom Domain

```typescript
const { url } = await vm.opencode.routeWeb({
  domain: "my-opencode.example.com",
});

const { client } = await vm.opencode.client({
  domain: "my-opencode-api.example.com",
});
```

## Options

```typescript
new VmOpenCode({
  serverPort: 4096, // Optional: API server port (default: 4096)
  webPort: 4097,    // Optional: Web UI port (default: 4097)
})
```

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `serverPort` | `number` | `4096` | Port for the OpenCode API server |
| `webPort` | `number` | `4097` | Port for the OpenCode web UI |

## API

### `vm.opencode.routeWeb(options?)`

Exposes the OpenCode web UI on a public domain.

**Options:**
- `domain?: string` - Custom domain to use. If not specified, generates a random subdomain.

**Returns:** `Promise<{ url: string }>`

```typescript
const { url } = await vm.opencode.routeWeb();
console.log(`OpenCode UI available at: ${url}`);
```

### `vm.opencode.client(options?)`

Creates an OpenCode SDK client connected to the server.

**Options:**
- `domain?: string` - Custom domain for the API endpoint. If not specified, generates a random subdomain.

**Returns:** `Promise<{ client: OpencodeClient }>`

```typescript
const { client } = await vm.opencode.client();

// List sessions
const sessions = await client.session.list();

// Create a new session
const session = await client.session.create({ path: "/workspace" });
```

### `vm.opencode.serverPort()`

Returns the configured API server port.

**Returns:** `number`

### `vm.opencode.webPort()`

Returns the configured web UI port.

**Returns:** `number`

## How It Works

The package uses systemd services to install and run OpenCode during VM creation:

1. Installs OpenCode via the official install script
2. Starts the OpenCode API server (`opencode serve`)
3. Starts the OpenCode web UI (`opencode web`)

Both services are configured to restart automatically and listen on all interfaces (0.0.0.0).

## Documentation

- [Freestyle Documentation](https://docs.freestyle.sh)
- [OpenCode Documentation](https://opencode.ai/docs)
