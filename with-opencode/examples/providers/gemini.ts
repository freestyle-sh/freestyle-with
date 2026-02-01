import "dotenv/config";
import { freestyle, VmSpec } from "freestyle-sandboxes";
import { VmOpenCode, type OpenCodeConfig } from "../../src/index.ts";

const config: OpenCodeConfig = {
  model: "google/gemini-2.5-flash",
  autoupdate: false,
};

const spec = new VmSpec({
  with: {
    opencode: new VmOpenCode({
      env: {
        GOOGLE_API_KEY: process.env.GOOGLE_API_KEY!,
      },
      config,
    }),
  },
});

const { vm } = await freestyle.vms.create({ spec });

const web = await vm.opencode.routeWeb();
console.log(`OpenCode Web IDE: ${web.url}`);

const { client } = await vm.opencode.client();

const session = await client.session.create({});
if (session.error) throw session.error;

const prompt = await client.session.prompt({
  sessionID: session.data.id,
  parts: [{ type: "text", text: "Write a poem about TypeScript and OpenCode." }],
});
if (prompt.error) throw prompt.error;

console.log("Response:", prompt.data);
