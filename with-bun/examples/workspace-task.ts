import "dotenv/config";
import { freestyle, VmSpec } from "freestyle-sandboxes";
import { VmBun } from "../src/index.ts";

const SOURCE_REPO = "https://github.com/freestyle-sh/freestyle-next";

const bun = new VmBun();
const workspace = bun.workspace({ path: "/root/app", install: true });
const appTask = workspace.task("dev", {
  env: {
    HOST: "0.0.0.0",
    PORT: "3000",
  },
});

const spec = new VmSpec()
  .with("bun", bun)
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
  logger: console.log
});

console.log(`Your app is running at http://${domain}`);
console.log(await vm.app.logs());