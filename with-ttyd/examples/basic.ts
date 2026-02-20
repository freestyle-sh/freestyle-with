import "dotenv/config";
import { freestyle, VmSpec } from "freestyle-sandboxes";
import { VmWebTerminal as VmTtyd } from "../src/index.ts";
import { VmDevServer } from "../../with-dev-server/src/index.ts";

const devLogs = new VmTtyd({
  port: 3010,
  command: "tmux attach -t dev-server",
  readOnly: true,
  cwd: "/root/repo",
});

const otherTerminals = new VmTtyd({
  port: 3011,
  cwd: "/root/repo",
});

const domain = `${crypto.randomUUID()}.style.dev`;

const innerDeps = new VmSpec({
  discriminator: "inner-deps",
  with: {
    devLogs: devLogs,
    otherTerminals: otherTerminals,
  },
  aptDeps: ["tmux"],
  // systemd: {
  //   services: [
  //     {
  //       name: "install-tmux",
  //       mode: "oneshot",
  //       bash: "apt-get update && apt-get install -y tmux",
  //       timeoutSec: 120,
  //     },
  //   ],
  // },
  additionalFiles: {
    "/root/.tmux.conf": {
      content: `set -g mouse on`,
    },
  },
});

const snapshot = new VmSpec({
  snapshot: innerDeps,
  with: {
    devServer: new VmDevServer({
      templateRepo: "https://github.com/freestyle-sh/freestyle-next",
      workdir: "/root/repo",
      devCommand: "tmux new -s dev-server npm run dev",
    }),
  },
});

const { vm, vmId } = await freestyle.vms.create({
  snapshot: snapshot,
  domains: [
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

console.log("npx freestyle-sandboxes vm ssh " + vmId);

console.log(`Terminal available at: https://dev-logs-${domain}`);
console.log(`Other terminals available at: https://other-terminals-${domain}`);
