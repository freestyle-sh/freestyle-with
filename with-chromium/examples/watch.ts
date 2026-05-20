import "dotenv/config";
import { freestyle, VmSpec } from "freestyle";
import { VmChromium } from "../src/index.ts";

type CdpResponse<TResult = unknown> = {
  id?: number;
  result?: TResult;
  error?: {
    code: number;
    message: string;
  };
};

class CdpClient {
  private nextId = 1;
  private readonly socket: WebSocket;
  private pending = new Map<
    number,
    {
      resolve: (value: unknown) => void;
      reject: (error: Error) => void;
    }
  >();

  constructor(socket: WebSocket) {
    this.socket = socket;

    socket.addEventListener("message", (event) => {
      const message = JSON.parse(String(event.data)) as CdpResponse;
      if (!message.id) {
        return;
      }

      const pending = this.pending.get(message.id);
      if (!pending) {
        return;
      }

      this.pending.delete(message.id);
      if (message.error) {
        pending.reject(new Error(message.error.message));
        return;
      }

      pending.resolve(message.result);
    });
  }

  static async connect(endpoint: string): Promise<CdpClient> {
    const socket = new WebSocket(endpoint);
    await new Promise<void>((resolve, reject) => {
      socket.addEventListener("open", () => resolve(), { once: true });
      socket.addEventListener(
        "error",
        () => reject(new Error(`Failed to connect to ${endpoint}`)),
        { once: true },
      );
    });

    return new CdpClient(socket);
  }

  close(): void {
    this.socket.close();
  }

  async send<TResult = unknown>(
    method: string,
    params: Record<string, unknown> = {},
    sessionId?: string,
  ): Promise<TResult> {
    const id = this.nextId++;
    const message = {
      id,
      method,
      params,
      ...(sessionId ? { sessionId } : {}),
    };

    const result = new Promise<TResult>((resolve, reject) => {
      this.pending.set(id, {
        resolve: (value) => resolve(value as TResult),
        reject,
      });
    });

    this.socket.send(JSON.stringify(message));
    return await result;
  }
}

const sleep = async (ms: number): Promise<void> => {
  await new Promise((resolve) => setTimeout(resolve, ms));
};

const interpolate = (
  from: { x: number; y: number },
  to: { x: number; y: number },
  steps: number,
): Array<{ x: number; y: number }> => {
  return Array.from({ length: steps }, (_, index) => {
    const ratio = index / Math.max(steps - 1, 1);
    return {
      x: Math.round(from.x + (to.x - from.x) * ratio),
      y: Math.round(from.y + (to.y - from.y) * ratio),
    };
  });
};

const movePointer = async (
  chromiumVm: typeof vm.chromium,
  points: Array<{ x: number; y: number }>,
): Promise<void> => {
  for (const point of points) {
    await chromiumVm.move(point);
    await sleep(90);
  }
};

const page = (title: string, accent: string, body: string): string => {
  return `data:text/html;charset=utf-8,${encodeURIComponent(`
    <!doctype html>
    <html>
      <head>
        <title>${title}</title>
        <style>
          * { box-sizing: border-box; }
          body {
            margin: 0;
            min-height: 160vh;
            font-family: Inter, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
            background: #f7f5ef;
            color: #202124;
          }
          main {
            display: grid;
            grid-template-columns: minmax(0, 1fr) 320px;
            gap: 24px;
            padding: 48px;
          }
          h1 { font-size: 56px; margin: 0 0 18px; letter-spacing: 0; }
          p { font-size: 20px; line-height: 1.5; max-width: 720px; }
          button, input {
            border: 2px solid #202124;
            border-radius: 6px;
            font-size: 18px;
            padding: 14px 18px;
          }
          button {
            background: ${accent};
            cursor: pointer;
            font-weight: 700;
            min-width: 180px;
          }
          aside {
            background: #ffffff;
            border: 2px solid #202124;
            border-radius: 8px;
            padding: 20px;
            height: max-content;
          }
          .log {
            margin-top: 18px;
            min-height: 44px;
            font-size: 18px;
            font-weight: 700;
          }
          .cursor-track {
            display: grid;
            grid-template-columns: repeat(5, 1fr);
            gap: 10px;
            margin-top: 32px;
            max-width: 720px;
          }
          .cursor-track span {
            border: 2px solid #202124;
            border-radius: 999px;
            padding: 16px;
            text-align: center;
            font-weight: 800;
            background: #ffffff;
          }
          .band {
            margin-top: 160px;
            padding: 48px;
            background: ${accent};
            color: #111111;
            font-size: 34px;
            font-weight: 800;
          }
        </style>
      </head>
      <body>
        <main>
          <section>
            <h1>${title}</h1>
            <p>${body}</p>
            <button id="primary">Click target</button>
            <div class="log" id="log">Waiting for CDP input</div>
            <div class="cursor-track">
              <span>1</span>
              <span>2</span>
              <span>3</span>
              <span>4</span>
              <span>5</span>
            </div>
            <div class="band">Scroll target reached</div>
          </section>
          <aside>
            <label for="field">Typed by CDP</label>
            <input id="field" value="" placeholder="watch this field" />
          </aside>
        </main>
        <script>
          document.getElementById("primary").addEventListener("click", () => {
            document.getElementById("log").textContent = "X11 click landed at " + new Date().toLocaleTimeString();
          });
        </script>
      </body>
    </html>
  `)}`;
};

const pages = [
  page("Watch Demo", "#87d7c5", "A read-only noVNC viewer can watch while CDP drives this browser."),
  page("CDP Navigation", "#f4c95d", "The script is navigating without granting VNC input access."),
  page("Button Pass", "#f08a7a", "The next step clicks a visible button and types into the field."),
  page("Final Loop", "#9fb4ff", "This loops for two minutes so the watch URL has continuous activity."),
];

const demoMs = Number(process.env.DEMO_MS ?? 120_000);
const chromium = new VmChromium({
  mode: "headed",
  homepage: "about:blank",
  screen: {
    width: 1280,
    height: 800,
  },
});

const { vmId, vm } = await freestyle.vms.create(
  new VmSpec({
    idleTimeoutSeconds: 900,
    with: {
      chromium,
    },
  }),
);

const watch = await vm.chromium.routeDisplay({ viewOnly: true });
const browserWSEndpoint = await vm.chromium.browserWSEndpoint({ route: true });

console.log(`VM: ${vmId}`);
console.log(`Read-only VNC: ${watch.url}`);
console.log(`CDP: ${browserWSEndpoint}`);
console.log(`Driving browser for ${Math.round(demoMs / 1000)} seconds...`);

const cdp = await CdpClient.connect(browserWSEndpoint);
const { targetId } = await cdp.send<{ targetId: string }>(
  "Target.createTarget",
  {
    url: "about:blank",
  },
);
const { sessionId } = await cdp.send<{ sessionId: string }>(
  "Target.attachToTarget",
  {
    targetId,
    flatten: true,
  },
);

await cdp.send("Page.enable", {}, sessionId);
await cdp.send("Runtime.enable", {}, sessionId);
await cdp.send("Input.setIgnoreInputEvents", { ignore: false }, sessionId);

const startedAt = Date.now();
let pageIndex = 0;

while (Date.now() - startedAt < demoMs) {
  const label = `cycle ${pageIndex + 1}`;
  await cdp.send(
    "Page.navigate",
    { url: pages[pageIndex % pages.length] },
    sessionId,
  );
  await sleep(2500);

  await cdp.send(
    "Runtime.evaluate",
    {
      expression: `
        document.getElementById("log").textContent = "CDP loaded ${label}; X11 pointer is moving next";
      `,
    },
    sessionId,
  );
  await sleep(700);

  await movePointer(
    vm.chromium,
    interpolate({ x: 90, y: 130 }, { x: 720, y: 250 }, 18),
  );
  await movePointer(
    vm.chromium,
    interpolate({ x: 720, y: 250 }, { x: 190, y: 250 }, 16),
  );
  await vm.chromium.click({ x: 190, y: 250 });
  await sleep(900);

  await movePointer(
    vm.chromium,
    interpolate({ x: 190, y: 250 }, { x: 1050, y: 165 }, 20),
  );
  await vm.chromium.click({ x: 1050, y: 165 });
  await vm.chromium.key({ keys: "ctrl+a" });
  await vm.chromium.type({ text: `visible X11 typing: ${label}`, delayMs: 15 });
  await sleep(900);

  await cdp.send(
    "Runtime.evaluate",
    {
      expression: `
        document.querySelectorAll(".cursor-track span").forEach((node, index) => {
          node.style.background = index % 2 === ${pageIndex % 2} ? "#202124" : "#ffffff";
          node.style.color = index % 2 === ${pageIndex % 2} ? "#ffffff" : "#202124";
        });
      `,
    },
    sessionId,
  );
  await movePointer(
    vm.chromium,
    interpolate({ x: 1050, y: 165 }, { x: 620, y: 380 }, 14),
  );
  await vm.chromium.scroll({ x: 620, y: 380, deltaY: 9 });
  await sleep(1600);

  await movePointer(
    vm.chromium,
    interpolate({ x: 620, y: 380 }, { x: 900, y: 690 }, 14),
  );
  await vm.chromium.scroll({ x: 900, y: 690, deltaY: -9 });
  await sleep(1000);

  pageIndex += 1;
}

cdp.close();
console.log("Done. The VM remains available until its idle timeout.");
