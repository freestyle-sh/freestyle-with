# freestyle-with Codebase Instructions

## Project Overview

This is a **pnpm workspace monorepo** that provides runtime environment extensions for the `freestyle-sandboxes` VM system. Each package adds a specific programming language runtime (Node.js, Python, Java) to Freestyle VMs by implementing the `VmWith` pattern.

## Architecture Pattern: VmWith Builders

All packages follow the **builder + instance** pattern from `freestyle-sandboxes`:

1. **Builder class** (extends `VmWith<T>`) - Defines VM configuration

   - `configure()`: Returns `CreateVmOptions` with systemd services, apt packages, or custom install scripts
   - `createInstance()`: Factory method returning runtime instance
   - `installServiceName()`: (Optional) Returns systemd service name for async installation tracking

2. **Instance class** (extends `VmWithInstance`) - Provides runtime methods
   - Attached to created VM via `vm.{key}` where key is from `with: { key: builder }`
   - Implements runtime-specific interfaces (e.g., `VmRunCodeInstance`)

**Example from `with-nodejs/src/index.ts`:**

```typescript
export class VmNodeJs extends VmWith<NodeJsRuntimeInstance> {
  configure(existingConfig: CreateVmOptions) {
    // Returns systemd oneshot service to install Node via nvm
    return this.compose(existingConfig, nodeJsConfig);
  }
  createInstance() {
    return new NodeJsRuntimeInstance(this);
  }
}

class NodeJsRuntimeInstance extends VmWithInstance {
  async runCode(code: string) {
    /* exec node -e */
  }
}
```

## Type System

Two shared type packages define runtime contracts:

- **`@freestyle-sh/with-type-js`**: For JavaScript runtimes (extends `VmRunCode` + adds `installServiceName()`)
- **`@freestyle-sh/with-type-run-code`**: Base interface for any runtime with `runCode()` method

These are workspace dependencies (`workspace:^`) used to ensure consistency across runtime packages.

## Package Structure

Each runtime package (`with-nodejs`, `with-python`, `with-java`):

- **Uses pkgroll** for building (`pnpm build` at root runs `pkgroll` in all packages)
- **Entry point**: `src/index.ts` → `dist/index.js` (ESM only, `"type": "module"`)
- **Examples**: `examples/*.ts` demonstrate usage with `freestyle.vms.create()`

## Key Conventions

### 1. VM Configuration via systemd

Runtimes are installed using **systemd oneshot services** that run on VM boot:

- Service scripts in `additionalFiles` (e.g., `/opt/install-nodejs.sh`)
- `deleteAfterSuccess: true` removes service after completion
- `timeoutSec: 300` prevents hanging installs

**Example from `with-java`:**

```typescript
systemd: {
  services: [
    {
      name: "install-java",
      mode: "oneshot",
      deleteAfterSuccess: true,
      exec: ["bash /opt/install-java.sh"],
      timeoutSec: 300,
    },
  ];
}
```

### 2. The `compose()` Method

Always merge new config with `existingConfig` using `this.compose()` to preserve other `VmWith` configurations:

```typescript
return this.compose(existingConfig, myRuntimeConfig);
```

### 3. runCode() Pattern

All `runCode()` implementations:

- Execute code via `this.vm.exec({ command: ... })`
- Expect JSON output on stdout (parse with `JSON.parse()`)
- Return `RunCodeResponse<Result>` with `result`, `stdout`, `stderr`, `statusCode`

## Development Workflow

### Build and Test

```bash
pnpm install          # Install all dependencies
pnpm build            # Build all packages with pkgroll
pnpm lint             # Run eslint across workspace
```

### Running Examples

Examples require `FREESTYLE_API_KEY` in `.env`:

```bash
cd with-nodejs
pnpm tsx examples/basic.ts
```

### Adding New Runtimes

1. Create package in workspace root (add to `pnpm-workspace.yaml`)
2. Copy structure from `with-python` (simplest reference)
3. Implement `configure()` with install logic (apt packages or custom script)
4. Implement `createInstance()` + runtime instance class
5. Use appropriate type package (`with-type-run-code` or `with-type-js`)
6. Add example in `examples/basic.ts`

## Common Pitfalls

- **Don't forget `compose()`**: Always merge configs or you'll overwrite other `VmWith` builders
- **Install scripts need error handling**: Use `set -e` in bash scripts to fail fast
- **Environment setup**: Node.js requires nvm init in `/etc/profile.d/` for shell availability
- **Workspace deps**: Use `workspace:^` for internal type packages, not version numbers
