import "dotenv/config";
import { freestyle } from "freestyle-sandboxes";
import { VmWebTerminal } from "../src/index.ts";

const terminalId = crypto.randomUUID();

const webTerminal = new VmWebTerminal([
  { id: "main", },
] as const);

const { vm } = await freestyle.vms.create({
  with: {
    terminal: webTerminal,
  },
});

const result = await vm.exec({ command: "echo hi" });
console.log("VM exec result:", result);

// Debug: Check if bash exists
const bashCheck = await vm.exec({ command: "which bash && ls -la /bin/bash" });
console.log("Bash check:", bashCheck);

// Debug: Check ttyd installation
const ttydCheck = await vm.exec({ command: "ls -la /usr/local/bin/ttyd && /usr/local/bin/ttyd --version" });
console.log("ttyd check:", ttydCheck);

// Debug: Check service status
const serviceStatus = await vm.exec({ command: "cat /etc/systemd/system/web-terminal-main.service" });
console.log("Service file:", serviceStatus);

await vm.terminal.main.route({
  domain: `${terminalId}-term.vmsa.swerdlow.dev`,
});

console.log(`Terminal available at: https://${terminalId}-term.vmsa.swerdlow.dev`);