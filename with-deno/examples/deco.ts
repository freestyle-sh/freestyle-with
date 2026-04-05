import "dotenv/config";
import { Freestyle, VmSpec } from "freestyle-sandboxes";
import { VmDeno } from "../src/index.ts";

const freestyle = new Freestyle({
  fetch: (url, body) => {
    console.log(JSON.stringify(body, null, 2));
    return fetch(url, body);
  },
});

const deno = new VmDeno();
const workspace = deno.workspace({ path: "/root/app", install: true });
const task = workspace.task("start", {
  env: {
    HOST: "0.0.0.0",
  },
});

const spec = new VmSpec()
  .with("deno", deno)
  .repo("https://github.com/deco-sites/storefront", "/root/app")
  .with("workspace", workspace)
  .with("app", task)
  .snapshot()
  .waitFor("curl http://localhost:8000", {
    timeoutSec: 240,
    name: "deno-app-ready",
  })
  .snapshot();

// const domain = `${crypto.randomUUID()}.style.dev`;
// const { repoId } = await freestyle.git.repos.create({
//   source: {
//     url: "https://github.com/deco-sites/storefront",
//   },
// });

// cache doesn't work
const { vmId, vm } = await freestyle.vms.create({
  spec: spec,
  //   domains: [
  //     {
  //       domain: domain,
  //       vmPort: 8000,
  //     },
  //   ],
  //   git: {
  //     repos: [
  //       {
  //         repo: repoId,
  //         path: "/root/app",
  //       },
  //     ],
  //   },
});

console.log("VM ID:", vmId);
// console.log("Domain:", domain);
