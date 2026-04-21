import "dotenv/config";
import { freestyle, VmSpec } from "freestyle";
import { VmNodeJs } from "../src/index.ts";

const node = new VmNodeJs();
const spec = new VmSpec().with("node", node);

const { vm, vmId } = await freestyle.vms.create({ spec });

console.log(vmId);

const res = await vm.node.runCode({
  code: `
  console.log(JSON.stringify({ hello: 'test' }));
  console.log(JSON.stringify({ hello: 'world' }));
  `,
});

console.log(res);
