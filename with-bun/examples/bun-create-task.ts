import "dotenv/config";
import { freestyle, VmSpec } from "freestyle-sandboxes";
import { VmBun } from "../src/index.ts";

const TEMPLATE = "elysia"; // any bun create template (elysia, hono, etc.)

const bun = new VmBun();
const workspace = bun.workspace({ path: "/root/app", install: false });
const appTask = workspace.task("dev", {
  env: {
    HOST: "0.0.0.0",
    PORT: "3000",
  },
});

const spec = new VmSpec()
  .with("bun", bun)
  .snapshot()
  .runCommands(`/opt/bun/bin/bun create ${TEMPLATE} /root/app`)
  .snapshot()
  .with("workspace", workspace)
  .with("app", appTask)
  .snapshot()
  .waitFor("curl http://localhost:3000", {
    timeoutSec: 10,
  })

const domain = `${crypto.randomUUID()}.style.dev`;

const { vm } = await freestyle.vms.create({
  spec,
  domains: [{ domain, vmPort: 3000 }],
});

console.log(`Your app is running at https://${domain}`);
console.log(await vm.app.logs());
