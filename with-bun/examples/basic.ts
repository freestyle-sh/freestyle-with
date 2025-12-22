import "dotenv/config";
import { freestyle } from "freestyle-sandboxes";
import { VmBun } from "../src/index.ts";

const { vm } = await freestyle.vms.create({
  with: {
    js: new VmBun(),
  },
});

const res = await vm.js.runCode({
  code: "console.log(JSON.stringify({ hello: 'world' }));"
});

console.log(res);
