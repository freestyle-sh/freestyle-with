import "dotenv/config";
import { freestyle, VmSpec } from "freestyle-sandboxes";
import { VmWebTerminal as VmTtyd } from "../src/index.ts";
import { VmDevServer } from "../../with-dev-server/src/index.ts";

const devLogs = new VmTtyd({
  port: 3010,
  command: "bash -lc 'bash /opt/dev-logs.sh'",
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
      content: `set -g mouse on
set -g status off`,
    },
    "/opt/dev-logs.sh": {
      content: `#!/usr/bin/env bash
set -euo pipefail

tmux new -A -s dev-logs "tail -n 200 -F /root/dev.log"`,
    },
    "/opt/dev-server.sh": {
      content: `#!/usr/bin/env bash
set -euo pipefail

set -o pipefail
: > /root/dev.log
FORCE_COLOR=1 npm run dev 2>&1 | tee -a /root/dev.log`,
    },
  },
});

const snapshot = new VmSpec({
  snapshot: innerDeps,
  with: {
    devServer: new VmDevServer({
      templateRepo: "https://github.com/freestyle-sh/freestyle-next",
      workdir: "/root/repo",
      devCommand: "bash -lc 'bash /opt/dev-server.sh'",
    }),
  },
});

const { vm, vmId } = await freestyle.vms.create({
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

console.log("npx freestyle-sandboxes vm ssh " + vmId);
console.log(`Dev server available at: https://${domain}`);
console.log(`Terminal available at: https://dev-logs-${domain}`);
console.log(`Other terminals available at: https://other-terminals-${domain}`);
