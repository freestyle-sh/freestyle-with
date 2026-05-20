import "dotenv/config";
import { freestyle, VmSpec } from "freestyle";
import { TigerVncBackend } from "@freestyle-sh/with-vnc";
import { VmChromium } from "../src/index.ts";

const chromium = new VmChromium({
  mode: "headed",
  vncBackend: new TigerVncBackend(),
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
  }),
);

const vnc = await vm.chromium.routeVnc();
const watch = await vm.chromium.routeVnc({ viewOnly: true });
const cdp = await vm.chromium.route();
const browser = await vm.chromium.cdpJsonVersion();

await vm.chromium.computerUse({
  action: "mouse_move",
  coordinate: [260, 220],
});

console.log(`VM: ${vmId}`);
console.log(`SSH: npx freestyle vm ssh ${vmId}`);
console.log(`TigerVNC: ${vnc.url}`);
console.log(`TigerVNC watch: ${watch.url}`);
console.log(`CDP: ${cdp.url}`);
console.log(`Browser: ${browser.Browser ?? "unknown"}`);
