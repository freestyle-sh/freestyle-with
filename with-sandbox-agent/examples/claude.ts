import { freestyle, VmSpec } from "freestyle-sandboxes";
import { VmSandboxAgent } from "../src/index.js";

const { vm } = await freestyle.vms.create({
  spec: new VmSpec({
    with: {
      sandboxAgent: new VmSandboxAgent({
        env: {
          
          ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY!,
        },
      }),
    },
  }),
});

// Get the client from the sandbox-agent instance
const { client } = await vm.sandboxAgent.client();

// Create a session with Claude
await client.createSession("my-session", {
  agent: "claude",
});

// Send a message
await client.postMessage("my-session", {
  message: "Write me a poem about dogs and cats living together in harmony.",
});

// Stream events
for await (const event of client.streamEvents("my-session", { offset: 0 })) {
  console.log(event.type, event.data);

}
