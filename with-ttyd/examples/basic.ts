import "dotenv/config";
import { freestyle, VmSpec } from "freestyle-sandboxes";
import { VmWebTerminal as VmTtyd } from "../src/index.ts";
import { VmDevServer } from "../../with-dev-server/src/index.ts";
import { VmPtySession } from "../../with-pty/src/index.ts";

const devPty = new VmPtySession({
  sessionId: "npm-dev",
});

const devCommandTtyd = new VmTtyd({
  port: 3010,
  pty: devPty,
  readOnly: true,
  cwd: "/root/repo",
});

const otherTerminals = new VmTtyd({
  port: 3011,
  cwd: "/root/repo",
});

const domain = `${crypto.randomUUID()}.style.dev`;

const snapshot = new VmSpec({
  with: {
    devCommandTtyd: devCommandTtyd,
    otherTerminals: otherTerminals,
    devServer: new VmDevServer({
      templateRepo: "https://github.com/freestyle-sh/freestyle-next",
      workdir: "/root/repo",
      devCommand: "npm run dev",
      devCommandPty: devPty,
    }),
  },
});

const { vmId, vm } = await freestyle.vms.create({
  snapshot: snapshot,
  domains: [
    {
      domain: domain,
      vmPort: 3000,
    },
    {
      domain: "dev-logs-" + domain,
      vmPort: 3010,
    },
    {
      domain: "other-terminals-" + domain,
      vmPort: 3011,
    },
  ],
});

await vm.devServer.getLogs().then(console.log);

console.log("npx freestyle-sandboxes vm ssh " + vmId);
console.log(`Dev server available at: https://${domain}`);
console.log(`Terminal available at: https://dev-logs-${domain}`);
console.log(`Other terminals available at: https://other-terminals-${domain}`);
