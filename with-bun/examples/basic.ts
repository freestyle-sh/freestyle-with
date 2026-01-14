import "dotenv/config";
import { freestyle, VmSpec } from "freestyle-sandboxes";
import { VmBun } from "../src/index.ts";

const spec = new VmSpec({
  with: {
    js: new VmBun(),
  },
});

const { vm } = await freestyle.vms.create({ spec });

const res = await vm.js.runCode({
  code: "console.log(JSON.stringify({ hello: 'world' }));",
});

console.log(res);
