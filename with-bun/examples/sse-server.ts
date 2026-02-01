import "dotenv/config";
import { readFileSync } from "node:fs";
import { freestyle, VmSpec } from "freestyle-sandboxes";
import { VmBun } from "../src/index.ts";

const SSE_SERVER_CODE = readFileSync(new URL("./sse-server-content.ts", import.meta.url), "utf-8");

const bun = new VmBun();

const spec = new VmSpec({
  with: {
    bun,
  },
  additionalFiles: {
    "/opt/sse-server.ts": {
      content: SSE_SERVER_CODE,
    },
  },
  systemd: {
    services: [
      {
        name: "sse-server",
        after: [bun.installServiceName()],
        exec: ["/opt/bun/bin/bun run /opt/sse-server.ts"],
        env: {
          BUN_INSTALL: "/opt/bun",
          PATH: "/opt/bun/bin:/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin",
        },
        mode: "service"
      },
    ],
  },
});

console.log("Creating VM with Bun runtime and SSE server...");
const { vm, vmId } = await freestyle.vms.create({ spec });
console.log("VM created:", vmId);

// Create domain mapping
const domain = `${crypto.randomUUID()}-sse-demo.style.dev`;
console.log("Creating domain mapping...");

await freestyle.domains.mappings.create({
  domain: domain,
  vmId: vmId,
  vmPort: 3000,
});

console.log(`\nSSE Server running on VM port 3000, mapped to: https://${domain}`);
console.log(`\nExample curls:`);
console.log(`  curl https://${domain}/health`);
console.log(`  curl https://${domain}/events`);
console.log(`\nFrom inside VM (via SSH):`);
console.log(`  curl http://localhost:3000/health`);
console.log(`  curl http://localhost:3000/events`);

// Wait for domain to propagate and verify health
console.log("\nWaiting for domain to propagate...");
let healthy = false;
for (let i = 0; i < 10; i++) {
  await new Promise((resolve) => setTimeout(resolve, 2000));
  try {
    const healthResponse = await fetch(`https://${domain}/health`);
    if (healthResponse.ok) {
      const healthData = await healthResponse.json();
      console.log("Health check:", healthData);
      healthy = true;
      break;
    }
  } catch {
    process.stdout.write(".");
  }
}
if (!healthy) {
  console.log("\nHealth check failed after retries");
}

// Consume SSE events
if (healthy) {
  console.log("\nConsuming SSE events...");
  try {
    const eventResponse = await fetch(`https://${domain}/events`);
    const reader = eventResponse.body?.getReader();
    const decoder = new TextDecoder();

    let eventCount = 0;
    while (reader && eventCount < 5) {
      const { done, value } = await reader.read();
      if (done) break;

      const text = decoder.decode(value);
      const lines = text.split("\n").filter((line) => line.startsWith("data:"));

      for (const line of lines) {
        const data = JSON.parse(line.replace("data: ", ""));
        console.log("Event:", data);
        eventCount++;
        if (eventCount >= 5) break;
      }
    }

    console.log(`\nReceived ${eventCount} SSE events`);
  } catch (error) {
    console.error("SSE failed:", error);
  }
}

// Create identity and access token for SSH
const { identity } = await freestyle.identities.create();
await identity.permissions.vms.grant({ vmId });
const { token } = await identity.tokens.create();

console.log("\n--- VM Access ---");
console.log(`VM ID: ${vmId}`);
console.log(`\nSSH command:`);
console.log(`  ssh ${vmId}:${token}@vm-ssh.freestyle.sh`);
