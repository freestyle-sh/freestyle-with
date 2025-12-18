import "dotenv/config";
import { freestyle } from "freestyle-sandboxes";
import { VmNodeJs } from "../index.ts";

const { vm } = await freestyle.vms.create({
  with: {
    js: new VmNodeJs({}),
  },
});

const res = await vm.js.runCode(
  "console.log(JSON.stringify({ hello: 'world' }));"
);

console.log(res);
