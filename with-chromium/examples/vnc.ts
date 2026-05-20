import "dotenv/config";
import { freestyle, VmSpec } from "freestyle";
import { VmChromium } from "../src/index.ts";

const chromium = new VmChromium({
  mode: "headed",
  homepage: "https://example.com",
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
  })
);

const display = await vm.chromium.routeDisplay();
const watch = await vm.chromium.routeDisplay({ viewOnly: true });
const cdp = await vm.chromium.route();
const browser = await vm.chromium.cdpJsonVersion();
const computer = await vm.chromium.anthropic.computerUseTool();
const screenshot = await vm.chromium.anthropic.computerUse({
  action: "screenshot",
});

console.log(`VM: ${vmId}`);
console.log(`SSH: npx freestyle vm ssh ${vmId}`);
console.log(`Display: ${display.url}`);
console.log(`Watch: ${watch.url}`);
console.log(`Display transport: ${display.transport}`);
console.log(`CDP: ${cdp.url}`);
console.log(`Browser: ${browser.Browser ?? "unknown"}`);
console.log(
  `Computer: ${computer.type} ${computer.display_width_px}x${computer.display_height_px}`,
);
console.log(`Screenshot: ${screenshot.base64_image ? "ok" : "missing"}`);
