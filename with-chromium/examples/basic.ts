import "dotenv/config";
import { freestyle, VmSpec } from "freestyle";
import { VmChromium } from "../src/index.ts";

const { vm } = await freestyle.vms.create(
  new VmSpec({
    with: {
      chromium: new VmChromium({
        mode: "headed",
        homepage: "https://example.com",
      }),
    },
  }),
);

const vnc = await vm.chromium.routeVnc();
const cdp = await vm.chromium.browserWSEndpoint({ route: true });
const screenshot = await vm.chromium.screenshot();

console.log({ vnc, cdp, screenshot: screenshot.mimeType });
