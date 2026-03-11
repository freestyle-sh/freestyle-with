/// <reference path="./direct-connect.d.ts" />

import { VmSpec, VmWith, VmWithInstance } from "freestyle-sandboxes";

import {
  Query,
  query,
  type Options as ClaudeCodeQueryOptions,
} from "@anthropic-ai/claude-agent-sdk";

export type VmClaudeCodeOptions = {
  // Add your options here
};

export type VmClaudeCodeResolvedOptions = {
  // Add your resolved options here
};

export class VmClaudeCode extends VmWith<VmClaudeCodeInstance> {
  options: VmClaudeCodeResolvedOptions;

  constructor(options?: VmClaudeCodeOptions) {
    super();
    this.options = {
      // Resolve options here
    };
  }

  override configureSnapshotSpec(spec: VmSpec): VmSpec {
    const installScript = `#!/bin/bash
set -e
export HOME=/root
curl -fsSL https://claude.ai/install.sh | bash
ln -sf /root/.local/bin/claude /usr/local/bin/claude
/usr/local/bin/claude --version
`;

    const claudeInit = `export PATH="$HOME/.local/bin:$PATH"
`;

    return this.composeSpecs(
      spec,
      new VmSpec({
        additionalFiles: {
          "/opt/install-claude-code.sh": {
            content: installScript,
          },
          "/etc/profile.d/claude.sh": {
            content: claudeInit,
          },
        },
        systemd: {
          services: [
            {
              name: "install-claude-code",
              mode: "oneshot",
              deleteAfterSuccess: true,
              exec: ["bash /opt/install-claude-code.sh"],
              timeoutSec: 300,
            },
          ],
        },
      }),
    );
  }

  createInstance(): VmClaudeCodeInstance {
    return new VmClaudeCodeInstance(this);
  }

  installServiceName(): string {
    return "install-claude-code.service";
  }
}

class VmClaudeCodeInstance extends VmWithInstance {
  builder: VmClaudeCode;

  constructor(builder: VmClaudeCode) {
    super();
    this.builder = builder;
  }

  query({prompt, options}: { prompt: string; options?: ClaudeCodeQueryOptions }): Query {
    return query({prompt, options: {
      ...options,
   
    }});
  }

  // Add more instance methods here

  

  // Add instance methods here
}
