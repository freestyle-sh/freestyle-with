import "dotenv/config";
import { freestyle, VmSpec } from "freestyle-sandboxes";
import { VmRuby } from "../src/index.ts";

const spec = new VmSpec({
  with: {
    ruby: new VmRuby(),
  },
});

const { vm } = await freestyle.vms.create({ spec });

// Install colorize gem
await vm.ruby.install({
  deps: ["colorize"],
});

// Use colorize to format output
const res = await vm.ruby.runCode({
  code: `
    require 'colorize'
    require 'json'
    result = {
      red: "Hello".red,
      green: "World".green,
      version: RUBY_VERSION
    }
    puts JSON.generate(result)
  `,
});

console.log(res);
