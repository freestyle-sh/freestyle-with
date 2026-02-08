# @freestyle-sh/with-k3s

A Freestyle VM extension that adds [k3s](https://k3s.io/) (lightweight Kubernetes) support to your VMs.

## Installation

```bash
npm install @freestyle-sh/with-k3s freestyle-sandboxes
# or
pnpm add @freestyle-sh/with-k3s freestyle-sandboxes
```

## Usage

### Basic Example

```typescript
import { freestyle, VmSpec } from "freestyle-sandboxes";
import { VmK3s } from "@freestyle-sh/with-k3s";

const spec = new VmSpec({
  with: {
    k3s: new VmK3s(),
  },
});

const { vm, vmId } = await freestyle.vms.create({ spec });

// Get cluster info
const clusterInfo = await vm.k3s.getClusterInfo();
console.log(clusterInfo.stdout);

// Apply a manifest
const manifest = `
apiVersion: apps/v1
kind: Deployment
metadata:
  name: nginx
spec:
  replicas: 1
  selector:
    matchLabels:
      app: nginx
  template:
    metadata:
      labels:
        app: nginx
    spec:
      containers:
      - name: nginx
        image: nginx:latest
`;

await vm.k3s.applyManifest(manifest);

// Get resources
const pods = await vm.k3s.getResources("pods", "default");
console.log(pods.data);

await freestyle.vms.delete({ vmId });
```

### Configuration Options

```typescript
new VmK3s({
  version: "v1.28.5+k3s1", // Optional: specific k3s version
  serverArgs: ["--disable=traefik"], // Optional: additional k3s server arguments
});
```

## API

### `VmK3sInstance`

The instance provides methods for interacting with the k3s cluster:

#### `kubectl(args: string[]): Promise<KubectlResult>`

Execute a kubectl command.

```typescript
const result = await vm.k3s.kubectl(["get", "pods", "-A"]);
console.log(result.stdout);
```

#### `applyManifest(manifest: string): Promise<ApplyManifestResult>`

Apply a Kubernetes manifest.

```typescript
const result = await vm.k3s.applyManifest(yamlManifest);
```

#### `deleteResource(resourceType: string, name: string, namespace?: string): Promise<KubectlResult>`

Delete a Kubernetes resource.

```typescript
await vm.k3s.deleteResource("deployment", "nginx", "default");
```

#### `getResources<T>(resourceType: string, namespace?: string): Promise<{success: boolean; data?: T; error?: string}>`

Get resources as JSON.

```typescript
const deployments = await vm.k3s.getResources("deployments", "default");
if (deployments.success) {
  console.log(deployments.data);
}
```

#### `getKubeconfig(): Promise<{success: boolean; content?: string; error?: string}>`

Get the kubeconfig file content.

```typescript
const config = await vm.k3s.getKubeconfig();
if (config.success) {
  console.log(config.content);
}
```

#### `getClusterInfo(): Promise<KubectlResult>`

Get cluster information.

```typescript
const info = await vm.k3s.getClusterInfo();
```

#### `getNodes(): Promise<KubectlResult>`

Get all nodes in the cluster.

```typescript
const nodes = await vm.k3s.getNodes();
```

## Examples

Check out the [examples](./examples) directory for more detailed usage:

- [basic.ts](./examples/basic.ts) - Basic usage with nginx deployment
- [advanced.ts](./examples/advanced.ts) - Advanced usage with namespace, service, and deployment

## Features

- ✅ Automatic k3s installation via systemd service
- ✅ Support for specific k3s versions
- ✅ Full kubectl command execution
- ✅ Manifest application and deletion
- ✅ JSON resource queries
- ✅ Kubeconfig access
- ✅ Cluster info and node inspection

## License

MIT
