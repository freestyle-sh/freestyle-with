import "dotenv/config";
import { freestyle, VmSpec } from "freestyle-sandboxes";
import { VmPython } from "../src/index.ts";

const spec = new VmSpec({
  with: {
    python: new VmPython(),
  },
});

const { vm } = await freestyle.vms.create({ spec });

const res = await vm.python.runCode({
  code: "import json; print(json.dumps({'hello': 'world'}))",
});

console.log(res);
