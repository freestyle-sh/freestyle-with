# @freestyle-sh/with-nodejs

Node.js runtime via [NVM](https://github.com/nvm-sh/nvm) for [Freestyle](https://freestyle.sh) VMs.

## Installation

```bash
npm install @freestyle-sh/with-nodejs freestyle-sandboxes
```

## Usage

```typescript
import { freestyle, VmSpec } from "freestyle-sandboxes";
import { VmDevServer } from "../src/index";

const TEMPLATE_REPO = "https://github.com/freestyle-sh/freestyle-next";

const { repoId } = await freestyle.git.repos.create({
  source: {
    url: TEMPLATE_REPO,
  },
});

const domain = `${repoId}.style.dev`;

const { vm } = await freestyle.vms.create({
  snapshot: new VmSpec({
    with: {
      devServer: new VmDevServer({
        workdir: "/repo",
        templateRepo: TEMPLATE_REPO,
        devCommand: "npm run dev",
      }),
    },
  }),
  with: {
    devServer: new VmDevServer({
      repo: repoId,
    }),
  },
  domains: [
    {
      domain: domain,
      vmPort: 3000,
    },
  ],
});

```
