import "dotenv/config";
import { freestyle } from "freestyle-sandboxes";
import { VmWebTerminal } from "../src/index.ts";

const terminal = new VmWebTerminal({
  servers: [
    {
      port: 3010,
      command: "",
    },
  ],
});

const domain = `${crypto.randomUUID()}.style.dev`;
const { vm } = await freestyle.vms.create({
  with: { terminal: terminal },
  domains: [
    {
      domain: `${crypto.randomUUID()}.style.dev`,
      vmPort: 3010,
    },
  ],
});

console.log(`Terminal available at: https://${domain}`);
