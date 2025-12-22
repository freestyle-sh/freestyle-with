import "dotenv/config";
import { freestyle } from "freestyle-sandboxes";
import { VmRuby } from "../src/index.ts";

const { vm } = await freestyle.vms.create({
  with: {
    ruby: new VmRuby(),
  },
});

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
