import "dotenv/config";
import { freestyle } from "freestyle-sandboxes";
import { VmWebTerminal } from "../src/index.ts";

const webTerminal = new VmWebTerminal([{ id: "main", credential: {
  username: "admin",
  password: "password123",
}}] as const);

const { vm } = await freestyle.vms.create({
  with: {
    terminal: webTerminal,
  },
});

const domain = `${crypto.randomUUID()}.style.dev`;
await vm.terminal.main.route({ domain });

console.log(`Terminal available at: https://${domain}`);
