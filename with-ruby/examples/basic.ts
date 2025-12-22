import "dotenv/config";
import { freestyle } from "freestyle-sandboxes";
import { VmRuby } from "../src/index.ts";

const { vm } = await freestyle.vms.create({
  with: {
    ruby: new VmRuby(),
  },
});

const res = await vm.ruby.runCode({
  code: "require 'json'; puts JSON.generate({ hello: 'world' })"
});

console.log(res);
