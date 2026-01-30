import "dotenv/config";
import { freestyle, VmSpec } from "freestyle-sandboxes";
import { VmOpenCode } from "../src/index.ts";

const spec = new VmSpec({
  with: {
    opencode: new VmOpenCode({
      web: {
        password: "secret-web-pass",
        username: "webadmin",
      },
    }),
  },
});

const { vm } = await freestyle.vms.create({ spec });

const web = await vm.opencode.routeWeb();
console.log(`OpenCode Web IDE: ${web.url}`);

const { client } = await vm.opencode.client();
console.log("OpenCode client connected:", !!client);

const files = await client.path.get({});
console.log("Root files:", files.data);
