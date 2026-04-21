import "dotenv/config";
import { freestyle, VmSpec } from "freestyle";
import { VmDeno } from "../src/index.ts";

const deno = new VmDeno();
const spec = new VmSpec().with("deno", deno);

const { vm } = await freestyle.vms.create({ spec });

// Install lodash-es (npm package - auto-prefixed)
await vm.deno.install({
  deps: ["lodash-es"],
});

// Use lodash-es
const res = await vm.deno.runCode({
  code: `
    import _ from "npm:lodash-es";
    const result = {
      chunk: _.chunk([1, 2, 3, 4, 5, 6], 2),
      uniq: _.uniq([1, 1, 2, 2, 3]),
      sum: _.sum([1, 2, 3, 4]),
    };
    console.log(JSON.stringify(result));
  `,
});

console.log(res);
