import "dotenv/config";
import { freestyle } from "freestyle-sandboxes";
import { VmWebTerminal } from "../src/index.ts";

const webTerminal = new VmWebTerminal([
  {
    id: "counter",
    readOnly: true,
    shell: "watch -n1 date",
  },
] as const);

const { vm } = await freestyle.vms.create({
  with: {
    terminal: webTerminal,
  },
});

const domain = `${crypto.randomUUID().slice(0, 8)}-readonly.style.dev`;
await vm.terminal.counter.route({ domain });

console.log(`Read-only counter: https://${domain}`);
