import "dotenv/config";
import { freestyle } from "freestyle-sandboxes";
import { VmWebTerminal } from "../src/index.ts";

const id = crypto.randomUUID().slice(0, 8);

const webTerminal = new VmWebTerminal([
  { id: "public" },
  { id: "private", credential: { username: "admin", password: "password123" } },
] as const);

const { vm } = await freestyle.vms.create({
  with: {
    terminal: webTerminal,
  },
});

await vm.terminal.public.route({ domain: `${id}-noauth.style.dev` });
await vm.terminal.private.route({ domain: `${id}-auth.style.dev` });

console.log(`Public terminal:  https://${id}-noauth.style.dev`);
console.log(`Private terminal: https://admin:password123@${id}-auth.style.dev`);
