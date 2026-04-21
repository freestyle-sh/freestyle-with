import "dotenv/config";
import { freestyle, VmSpec } from "freestyle";
import { VmVscode } from "../src/index.ts";

const vscode = new VmVscode({
  workdir: "/root",
});

const domain = `${crypto.randomUUID()}.style.dev`;

const { vmId, vm } = await freestyle.vms.create({
  snapshot: new VmSpec({
    with: {
      vscode,
    },
  }),
  domains: [
    {
      domain,
      vmPort: 8080,
    },
  ],
});

console.log("npx freestyle vm ssh " + vmId);
console.log(`VS Code available at: https://${domain}`);
