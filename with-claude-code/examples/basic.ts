import "dotenv/config";
import { freestyle, VmSpec } from "freestyle";
import { VmClaudeCode } from "../src/index.ts";

const spec = new VmSpec({
  with: {
    claude: new VmClaudeCode(),
  },
});

const { vm } = await freestyle.vms.create({ spec });

const res = await vm.exec({ command: "claude --version" });
console.log(res);
