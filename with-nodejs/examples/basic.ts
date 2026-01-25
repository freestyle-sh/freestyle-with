import "dotenv/config";
import { freestyle, VmSpec } from "freestyle-sandboxes";
import { VmNodeJs } from "../src/index.ts";

const spec = new VmSpec({
  with: {
    node: new VmNodeJs({}),
  },
});

const { vm, vmId } = await freestyle.vms.create({ spec });

console.log(vmId);

const res = await vm.node.runCode({
  code: `
  console.log(JSON.stringify({ hello: 'test' }));
  console.log(JSON.stringify({ hello: 'world' }));
  `,
});

console.log(res);
