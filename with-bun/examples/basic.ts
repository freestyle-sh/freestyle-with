import "dotenv/config";
import { freestyle, VmSpec } from "freestyle-sandboxes";
import { VmBun } from "../src/index.ts";

const bun = new VmBun();
const spec = new VmSpec().with("bun", bun);

const { vm } = await freestyle.vms.create({ spec });

const res = await vm.bun.runCode({
  code: "console.log(JSON.stringify({ hello: 'world' }));",
});

console.log(res);
