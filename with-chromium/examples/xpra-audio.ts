import "dotenv/config";
import { freestyle, VmSpec } from "freestyle";
import { XpraDisplayBackend } from "@freestyle-sh/with-xpra";
import { VmChromium } from "../src/index.ts";

const audioPage = `data:text/html;charset=utf-8,${encodeURIComponent(`
  <!doctype html>
  <html>
    <head>
      <title>Xpra Audio Demo</title>
      <style>
        * { box-sizing: border-box; }
        body {
          margin: 0;
          min-height: 100vh;
          display: grid;
          place-items: center;
          font-family: Inter, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
          background: #f5f3ea;
          color: #171717;
        }
        main {
          width: min(760px, calc(100vw - 48px));
          display: grid;
          gap: 18px;
        }
        h1 {
          margin: 0;
          font-size: 48px;
          letter-spacing: 0;
        }
        p {
          margin: 0;
          font-size: 20px;
          line-height: 1.45;
        }
        button {
          width: max-content;
          border: 2px solid #171717;
          border-radius: 6px;
          background: #87d7c5;
          color: #171717;
          font: inherit;
          font-weight: 800;
          padding: 14px 18px;
          cursor: pointer;
        }
        output {
          min-height: 32px;
          font-size: 18px;
          font-weight: 700;
        }
      </style>
    </head>
    <body>
      <main>
        <h1>Xpra Audio Demo</h1>
        <p>This page plays a repeating Web Audio tone through Chromium. Open the routed Xpra display URL and enable audio in the browser tab if prompted.</p>
        <button id="toggle">Start tone</button>
        <output id="status">Audio idle</output>
      </main>
      <script>
        let context;
        let oscillator;
        let gain;
        const status = document.getElementById("status");
        const toggle = document.getElementById("toggle");

        async function startTone() {
          context = context || new AudioContext();
          await context.resume();

          oscillator = context.createOscillator();
          gain = context.createGain();
          oscillator.type = "sine";
          oscillator.frequency.value = 440;
          gain.gain.value = 0.08;
          oscillator.connect(gain);
          gain.connect(context.destination);
          oscillator.start();
          status.textContent = "Tone playing at 440 Hz";
          toggle.textContent = "Stop tone";
        }

        function stopTone() {
          oscillator?.stop();
          oscillator?.disconnect();
          gain?.disconnect();
          oscillator = undefined;
          gain = undefined;
          status.textContent = "Audio stopped";
          toggle.textContent = "Start tone";
        }

        toggle.addEventListener("click", async () => {
          if (oscillator) {
            stopTone();
            return;
          }

          await startTone();
        });

        setTimeout(() => startTone().catch(() => {
          status.textContent = "Click Start tone to begin audio";
        }), 700);
      </script>
    </body>
  </html>
`)}`;

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const waitForCdp = async <T>(
  readVersion: () => Promise<T>,
  timeoutMs = 120_000,
): Promise<T> => {
  const deadline = Date.now() + timeoutMs;
  let lastError: unknown;

  while (Date.now() < deadline) {
    try {
      return await readVersion();
    } catch (error) {
      lastError = error;
      await sleep(1_000);
    }
  }

  if (lastError instanceof Error) {
    throw lastError;
  }

  throw new Error("Timed out waiting for Chromium CDP.");
};

const { vmId, vm } = await freestyle.vms.create({
  logger: console.log,
  spec: new VmSpec({
    idleTimeoutSeconds: 900,
    with: {
      chromium: new VmChromium({
        mode: "headed",
        user: "browser",
        displayBackend: new XpraDisplayBackend(),
        extraArgs: ["--autoplay-policy=no-user-gesture-required"],
        homepage: audioPage,
        screen: {
          width: 1280,
          height: 800,
        },
      }),
    },
  }),
});

const display = await vm.chromium.routeDisplay();
const cdp = await vm.chromium.route();

console.log(`VM: ${vmId}`);
console.log(`SSH: npx freestyle vm ssh ${vmId}`);
console.log(`Xpra display: ${display.url}`);
console.log(`Audio: ${display.capabilities.audio ? "enabled" : "disabled"}`);
console.log(`CDP: ${cdp.url}`);
const browser = await waitForCdp(() => vm.chromium.cdpJsonVersion());
console.log(`Browser: ${browser.Browser ?? "unknown"}`);
