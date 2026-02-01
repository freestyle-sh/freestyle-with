const server = Bun.serve({
  port: 3000,
  fetch(req) {
    const url = new URL(req.url);

    // SSE endpoint - streams counter events every second
    if (url.pathname === "/events") {
      let counter = 0;
      const stream = new ReadableStream({
        start(controller) {
          const interval = setInterval(() => {
            counter++;
            const data = JSON.stringify({ count: counter, timestamp: Date.now() });
            controller.enqueue("data: " + data + "\n\n");

            if (counter >= 10) {
              clearInterval(interval);
              controller.close();
            }
          }, 1000);
        }
      });

      return new Response(stream, {
        headers: {
          "Content-Type": "text/event-stream",
          "Cache-Control": "no-cache",
          "Connection": "keep-alive",
        },
      });
    }

    // Health check endpoint
    if (url.pathname === "/health") {
      return new Response(JSON.stringify({ status: "ok" }), {
        headers: { "Content-Type": "application/json" }
      });
    }

    return new Response("SSE Server - GET /events for event stream");
  },
});

console.log("Server listening on port 3000");
console.log("");
console.log("Example curls:");
console.log("  curl http://localhost:3000/health");
console.log("  curl http://localhost:3000/events");
