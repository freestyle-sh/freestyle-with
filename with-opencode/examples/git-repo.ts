import "dotenv/config";
import { freestyle, VmSpec } from "freestyle-sandboxes";
import { VmOpenCode } from "../src/index.ts";

/**
 * Example: OpenCode session with a cloned git repository
 *
 * This creates a Freestyle VM with:
 * - The freestyle-with repo cloned to /repo
 * - OpenCode running with a session in /repo
 * - Web UI for interactive coding
 */

const spec = new VmSpec({
  with: {
    opencode: new VmOpenCode({
      env: {
        ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY!,
      },
      config: {
        model: "claude-sonnet-4-5-20250929",
        autoupdate: false,
      },
    }),
  },
  gitRepos: [
    {
      repo: "https://github.com/freestyle-sh/freestyle-with",
      path: "/repo",
    },
  ],
});

const { vm } = await freestyle.vms.create({ spec });

// Expose the web UI
const web = await vm.opencode.routeWeb();
console.log(`OpenCode Web IDE: ${web.url}`);

// Connect the API client
const { client } = await vm.opencode.client();
console.log("OpenCode client connected");

// List the cloned repo contents
const repoFiles = await client.path.get({ directory: "/repo" });
console.log("Repo contents:", repoFiles.data);

// Create a session in the repo directory
const session = await client.session.create({ directory: "/repo" });
console.log("Session created in /repo:", session.data?.id);

// Subscribe to global events to stream the response
const events = await client.global.event();

console.log("\n--- Streaming response ---\n");

// Start consuming the stream and sending the prompt concurrently
const streamPromise = (async () => {
  for await (const event of events.stream) {
    const normalized = (event as any).payload ?? event;

    if (normalized.type === "message.part.updated") {
      const { part, delta } = normalized.properties;

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
      normalized.type === "session.idle" &&
      normalized.properties.sessionID === session.data!.id
    ) {
      console.log("\n\n--- Response complete ---");
      break;
    }
  }
})();

// Start the prompt asynchronously
const promptResult = await client.session.promptAsync({
  sessionID: session.data!.id!,
  directory: "/repo",
  model: {
    modelID: "claude-sonnet-4-5-20250929",
    providerID: "anthropic",
  },
  parts: [{ type: "text", text: "Explain the purpose of this repository." }],
});

if (promptResult.error) {
  console.error("Error during prompt:", promptResult.error);
  process.exit(1);
}

// Wait for streaming to complete
await streamPromise;

process.exit(0);
