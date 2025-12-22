import "dotenv/config";
import { freestyle } from "freestyle-sandboxes";
import { VmBun } from "../src/index.ts";

const { vm } = await freestyle.vms.create({
  with: {
    bun: new VmBun(),
  },
});

// Install mathjs
await vm.bun.install({
  deps: ["mathjs"],
});

// Use mathjs to do some calculations
const res = await vm.bun.runCode({
  code: `
    const { evaluate } = require('mathjs');
    const result = {
      expression: '2 + 3 * 4',
      result: evaluate('2 + 3 * 4'),
      sqrt: evaluate('sqrt(16)'),
      sin: evaluate('sin(pi / 2)'),
    };
    console.log(JSON.stringify(result));
  `,
});

console.log(res);
