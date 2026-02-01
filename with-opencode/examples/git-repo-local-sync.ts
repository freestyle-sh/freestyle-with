import { createOpencode } from "@opencode-ai/sdk/v2";
import "dotenv/config";

const cwd = process.cwd();

const { client } = await createOpencode({
  config: {
    model: "claude-sonnet-4-5-20250929",
    autoupdate: false,
  }
});
console.log("OpenCode client connected");

const session = await client.session.create({ directory: cwd });
console.log(`Session created in ${cwd}:`, session.data?.id);

console.log("\nSending prompt (sync)...\n");

// Use synchronous prompt - this blocks until complete
const result = await client.session.prompt({
  sessionID: session.data!.id!,
  model: {
    modelID: "claude-sonnet-4-5-20250929",
    providerID: "anthropic",
  },
  parts: [{ type: "text", text: "Say hello in one sentence." }],
});

console.log("Prompt result:", result);

// Get the messages to see the response
const messages = await client.session.messages({
  sessionID: session.data!.id!,
});

console.log("\nMessages:", JSON.stringify(messages.data, null, 2));

process.exit(0);
