import "dotenv/config";
import { freestyle, VmSpec } from "freestyle";
import { VmNodeJs } from "../src/index.ts";

const SOURCE_REPO = "https://github.com/freestyle-sh/freestyle-next";

const node = new VmNodeJs();
const workspace = node.workspace({ path: "/root/app", install: true });
const appTask = workspace.task("dev", {
  env: {
    HOST: "0.0.0.0",
    PORT: "3000",
  },
});

const spec = new VmSpec()
  .with("node", node)
  .repo(SOURCE_REPO, "/root/app")
  .with("workspace", workspace)
  .with("app", appTask)
  .snapshot()
  .waitFor("curl http://localhost:3000")
  .snapshot();

const { repoId } = await freestyle.git.repos.create({
  source: {
    url: SOURCE_REPO,
  },
});

const domain = `${repoId}.style.dev`;

const { vm } = await freestyle.vms.create({
  spec,
  domains: [{ domain, vmPort: 3000 }],
  git: {
    repos: [{ repo: repoId, path: "/root/app" }],
  },
});

console.log(await vm.app.logs());