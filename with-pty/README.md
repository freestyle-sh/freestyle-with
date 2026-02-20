# @freestyle-sh/with-pty

Generic PTY helper for Freestyle VMs, backed by tmux.

By default, PTY helpers also add `/root/.tmux.conf` with:

```tmux
set -g mouse on
set -g status off
```

Set `applyDefaultTmuxConfig: false` to opt out.

## Installation

```bash
pnpm add @freestyle-sh/with-pty freestyle-sandboxes
```

## Usage

```ts
import { freestyle, VmSpec } from "freestyle-sandboxes";
import { VmPty } from "@freestyle-sh/with-pty";

const { vm } = await freestyle.vms.create({
  snapshot: new VmSpec({
    with: {
      pty: new VmPty(),
    },
  }),
});

const ptyHandle = await vm.pty.createPtySession({
  id: "dev",
  command: "npm run dev",
  cwd: "/root/repo",
  ptySize: { cols: 120, rows: 30 },
  reset: true,
});

await ptyHandle.sendInput("echo hello from pty\n");

await ptyHandle.resize({ cols: 160, rows: 40 });

const sessions = await vm.pty.listPtySessions();
console.log(sessions.map((s) => s.id));

const output = await ptyHandle.read({
  lines: 80,
});

console.log(output);

const result = await ptyHandle.wait({ timeoutMs: 5_000 });
console.log(result.exitCode);
```

## API

- Process-level methods:
  - `createPtySession({ id, command, cwd, envs, ptySize, reset })`
  - `connectPtySession(sessionId)`
  - `listPtySessions()`
  - `getPtySessionInfo(sessionId)`
  - `resizePtySession(sessionId, ptySize)`
  - `killPtySession(sessionId)`
  - `attachCommand({ sessionId, readOnly })`
- Handle methods (`PtyHandle`):
  - `sendInput(data)`
  - `read({ lines, includeEscape })`
  - `resize(ptySize)`
  - `wait({ timeoutMs, pollIntervalMs, lines, onData })`
  - `waitForConnection(timeoutMs)`
  - `isConnected()`
  - `disconnect()`
  - `kill()`

Note: This implementation uses tmux under the hood. It mirrors Daytona-style semantics where practical, but does not expose a websocket stream; `wait`/`read` use polling via tmux capture.
