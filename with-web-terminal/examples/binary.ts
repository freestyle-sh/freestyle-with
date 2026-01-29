import "dotenv/config";
import { freestyle, VmSpec } from "freestyle-sandboxes";
import { VmWebTerminal } from "../src/index.ts";

const id = crypto.randomUUID().slice(0, 8);

const webTerminal = new VmWebTerminal([{ id: "main", command: "bash -lc claude" }] as const);

const { vm } = await freestyle.vms.create({
  spec: new VmSpec({
    snapshot: new VmSpec({
        additionalFiles: {
            "/opt/install-claude.sh": {
                content: `#!/bin/bash

                curl -fsSL https://claude.ai/install.sh | bash

                echo 'export PATH="$HOME/.local/bin:$PATH"' >> ~/.bashrc 
                `,
            }
        },
      systemd: {
        
        services: [
          {
            name: "install-claude",
            mode: "oneshot",
            exec: [
              `bash /opt/install-claude.sh`,
            ],
          },
        ],
      },
    }),
    with: {
      terminal: webTerminal,
    },
  }),
});

await vm.terminal.main.route({ domain: `${id}-claude.style.dev` });

console.log(`Main terminal: https://${id}-claude.style.dev`);
