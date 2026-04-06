import "dotenv/config";
import { freestyle, VmSpec } from "freestyle-sandboxes";
import { VmDeno } from "../src/index.ts";

const deno = new VmDeno();
const spec = new VmSpec().with("deno", deno);

const { vm } = await freestyle.vms.create({ spec });

const res = await vm.deno.runCode({
  code: "console.log(JSON.stringify({ hello: 'world', runtime: 'deno' }));",
});

console.log(res);
