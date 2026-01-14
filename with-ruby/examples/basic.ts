import "dotenv/config";
import { freestyle, VmSpec } from "freestyle-sandboxes";
import { VmRuby } from "../src/index.ts";

const spec = new VmSpec({
  with: {
    ruby: new VmRuby(),
  },
});

const { vm } = await freestyle.vms.create({ spec });

const res = await vm.ruby.runCode({
  code: "require 'json'; puts JSON.generate({ hello: 'world' })",
});

console.log(res);
