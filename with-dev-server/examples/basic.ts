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
