import "dotenv/config";
import { freestyle, VmSpec } from "freestyle-sandboxes";
import { VmPty } from "../src/index.ts";

const { vm, vmId } = await freestyle.vms.create({
  snapshot: new VmSpec({
    with: {
      pty: new VmPty({
        defaultWorkdir: "/root",
      }),
    },
  }),
});

console.log("Created VM", vmId);

const ptyHandle = await vm.pty.createPtySession({
  id: "shell",
  command: "bash -l",
  cwd: "/root",
  reset: true,
});

await ptyHandle.sendInput("echo pty is working\n");

const output = await ptyHandle.read({
  lines: 40,
  includeEscape: false,
});

console.log(output);

const info = await vm.pty.getPtySessionInfo("shell");
console.log("session", info.id, `${info.cols}x${info.rows}`);
