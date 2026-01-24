import "dotenv/config";
import { freestyle, VmSpec } from "freestyle-sandboxes";
import { VmUv } from "../src/index.ts";

const spec = new VmSpec({
  with: {
    uv: new VmUv(),
  },
});

const { vm } = await freestyle.vms.create({ spec });

const res = await vm.uv.runCode({
  code: "import json; print(json.dumps({ 'hello': 'world' }))",
});

console.log(res);
