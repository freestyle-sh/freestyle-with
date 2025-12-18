import "dotenv/config";
import { freestyle } from "freestyle-sandboxes";
import { VmPython } from "../src/index.ts";

const { vm } = await freestyle.vms.create({
  with: {
    python: new VmPython(),
  },
});

const res = await vm.python.runCode(
  "import json; print(json.dumps({'hello': 'world'}))"
);

console.log(res);
