import "dotenv/config";
import { freestyle, VmSpec } from "freestyle-sandboxes";
import { VmPlaywright } from "../src/index.ts";

const spec = new VmSpec({
  with: {
    playwright: new VmPlaywright(),
  },
});

const { vm } = await freestyle.vms.create({ spec });

const res = await vm.playwright.runCode({
  code: `
  const { chromium } = require("playwright");

  (async () => {
    const browser = await chromium.launch();
    const page = await browser.newPage();
    await page.goto("https://example.com");
    const title = await page.title();
    await browser.close();
    console.log(JSON.stringify({ title }));
  })().catch((err) => {
    console.error(err);
    process.exit(1);
  });
  `,
});

console.log(res);
