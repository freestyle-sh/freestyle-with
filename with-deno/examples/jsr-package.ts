import "dotenv/config";
import { freestyle, VmSpec } from "freestyle-sandboxes";
import { VmDeno } from "../src/index.ts";

const deno = new VmDeno();
const spec = new VmSpec().with("deno", deno);

const { vm } = await freestyle.vms.create({ spec });

// Install @std/path from JSR (Deno standard library)
await vm.deno.install({
  deps: ["jsr:@std/path"],
});

// Use @std/path for path manipulation
const res = await vm.deno.runCode({
  code: `
    import * as path from "jsr:@std/path";
    const result = {
      join: path.join("foo", "bar", "baz"),
      basename: path.basename("/home/user/file.txt"),
      extname: path.extname("document.pdf"),
      dirname: path.dirname("/home/user/file.txt"),
    };
    console.log(JSON.stringify(result));
  `,
});

console.log(res);
