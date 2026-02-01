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

### With Authentication

```typescript
import { freestyle, VmSpec } from "freestyle-sandboxes";
import { VmOpenCode } from "@freestyle-sh/with-opencode";

const { vm } = await freestyle.vms.create({
  spec: new VmSpec({
    with: {
      opencode: new VmOpenCode({
        server: {
          username: "serveradmin",
          password: "secret-server-pass",
        },
        web: {
          username: "webadmin",
          password: "secret-web-pass",
        },
      }),
    },
  }),
});

// URLs will include credentials automatically
const { url } = await vm.opencode.routeWeb();
const { client } = await vm.opencode.client();
```

## Options

```typescript
new VmOpenCode({
  server: {
    port: 4096, // Optional: API server port (default: 4096)
    username: "admin", // Optional: Basic auth username (default: "opencode" when password is set)
    password: "secret", // Optional: Basic auth password
  },
  web: {
    port: 4097, // Optional: Web UI port (default: 4097)
    username: "admin", // Optional: Basic auth username (default: "opencode" when password is set)
    password: "secret", // Optional: Basic auth password
  },
  env: {
    ANTHROPIC_API_KEY: "sk-ant-...", // Optional: Environment variables for OpenCode
  },
});
```

| Option            | Type                     | Default      | Description                                      |
| ----------------- | ------------------------ | ------------ | ------------------------------------------------ |
| `server.port`     | `number`                 | `4096`       | Port for the OpenCode API server                 |
| `server.username` | `string`                 | `"opencode"` | Basic auth username (only used if password set)  |
| `server.password` | `string`                 | -            | Basic auth password for the API server           |
| `web.port`        | `number`                 | `4097`       | Port for the OpenCode web UI                     |
| `web.username`    | `string`                 | `"opencode"` | Basic auth username (only used if password set)  |
| `web.password`    | `string`                 | -            | Basic auth password for the web UI               |
| `env`             | `Record<string, string>` | `{}`         | Environment variables passed to OpenCode processes |

## Environment Variables

OpenCode requires API keys to interact with AI providers. When running in a Freestyle VM, pass the required keys using the `env` option.

> **Note:** Environment variables are stored as plain text in the VM's startup scripts. Users with direct or indirect access to the VM may be able to view these values. Use appropriately scoped API keys and rotate them if the VM is shared or exposed.

| Variable              | Description                |
| --------------------- | -------------------------- |
| `ANTHROPIC_API_KEY`   | API key for Claude models  |
| `OPENAI_API_KEY`      | API key for OpenAI models  |
| `OPENROUTER_API_KEY`  | API key for OpenRouter     |

See [OpenCode Providers](https://opencode.ai/docs/providers/) for all supported providers and their environment variables.

```typescript
const { vm } = await freestyle.vms.create({
  spec: new VmSpec({
    with: {
      opencode: new VmOpenCode({
        env: {
          ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY!,
        },
      }),
    },
  }),
});
```

## API

### `vm.opencode.routeWeb(options?)`

Exposes the OpenCode web UI on a public domain.

**Options:**

- `domain?: string` - Custom domain to use. If not specified, generates a random subdomain.

**Returns:** `Promise<{ url: string }>` - URL includes credentials if authentication is configured.

```typescript
const { url } = await vm.opencode.routeWeb();
console.log(`OpenCode UI available at: ${url}`);
```

### `vm.opencode.client(options?)`

Creates an OpenCode SDK client connected to the server. The client is automatically configured with credentials if authentication is enabled.

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
