import "dotenv/config";
import { freestyle, VmSpec } from "freestyle-sandboxes";
import { VmOpenCode } from "../src/index.ts";

/**
 * Example: OpenCode session with a cloned git repository (sync)
 *
 * This creates a Freestyle VM with:
 * - The freestyle-with repo cloned to /repo
 * - OpenCode running with a session in /repo
 * - Uses synchronous prompt (blocks until complete)
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
      }
    }),
  },
  gitRepos: [
    {
      repo: "https://github.com/freestyle-sh/freestyle-with",
      path: "/repo",
    }
  ]
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

console.log("\nSending prompt (sync)...\n");

// Use synchronous prompt - blocks until complete
const result = await client.session.prompt({
  sessionID: session.data!.id!,
  parts: [{ type: "text", text: "Explain the purpose of this repository." }],
});

if (result.error) {
  console.error("Error during prompt:", result.error);
  process.exit(1);
}

// Extract text from the response parts
const textParts = result.data?.parts?.filter((p: any) => p.type === "text") ?? [];
for (const part of textParts) {
  console.log(part.text);
}

console.log("\n--- Response complete ---");
console.log("Cost:", result.data?.info?.cost);
console.log("Tokens:", result.data?.info?.tokens);

process.exit(0);
