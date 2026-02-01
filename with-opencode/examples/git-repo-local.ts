import { createOpencode } from "@opencode-ai/sdk/v2";
import "dotenv/config";

const cwd = process.cwd();

// Connect the API client
const { client } = await createOpencode({
  config: {
    model: "claude-sonnet-4-5-20250929",
    autoupdate: false,
  }
});
console.log("OpenCode client connected");

// List the repo contents
const repoFiles = await client.path.get({ directory: cwd });
console.log("Repo contents:", repoFiles.data);

// Create a session in the current directory
const session = await client.session.create({ directory: cwd });
console.log(`Session created in ${cwd}:`, session.data?.id);

// Subscribe to global events to stream the response
const events = await client.global.event();

console.log("\n--- Streaming response ---\n");

// Start consuming the stream and sending the prompt concurrently
const streamPromise = (async () => {
  for await (const event of events.stream) {
    const { payload } = event as { payload: { type: string; properties: any } };

    if (payload.type === "message.part.updated") {
      const { part, delta } = payload.properties;

      // Stream text deltas as they arrive
      if (part.type === "text" && delta) {
        process.stdout.write(delta);
      }

      // Show tool calls
      if (part.type === "tool" && part.state.status === "running") {
        console.log(`\n[Tool: ${part.tool}]`);
      }
    }

    // Stop when the session becomes idle
    if (
      payload.type === "session.idle" &&
      payload.properties.sessionID === session.data!.id
    ) {
      console.log("\n\n--- Response complete ---");
      break;
    }
  }
})();

// Start the prompt (don't await yet)
const promptResult = await client.session.promptAsync({
  sessionID: session.data!.id!,
  model: {
    modelID: "claude-sonnet-4-5-20250929",
    providerID: "anthropic",
  },
  parts: [{ type: "text", text: "Explain the purpose of this repository. List the withs in it" }],
});

if (promptResult.error) {
  console.error("Error during prompt:", promptResult.error);
  process.exit(1);
}

// Wait for streaming to complete
await streamPromise;

process.exit(0);
