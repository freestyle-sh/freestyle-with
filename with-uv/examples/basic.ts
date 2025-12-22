import "dotenv/config";
import { freestyle } from "freestyle-sandboxes";
import { VmUv } from "../src/index.ts";

const { vm } = await freestyle.vms.create({
  with: {
    uv: new VmUv(),
  },
});

const res = await vm.uv.runCode({
  code: "import json; print(json.dumps({ 'hello': 'world' }))"
});

console.log(res);
