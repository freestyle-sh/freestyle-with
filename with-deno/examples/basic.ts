import "dotenv/config";
import { freestyle, VmBaseImage, VmSpec } from "freestyle";
import { VmDeno } from "../src/index.ts";

const deno = new VmDeno();
const spec = new VmSpec().baseImage(new VmBaseImage().from("debian:trixie-slim").runCommands("echo test2")).with("deno", deno);

const { vm } = await freestyle.vms.create({ spec, logger: console.log });

freestyle.vms.snapshots.delete({ snapshotId: "..." })

const res = await vm.deno.runCode({
  code: "console.log(JSON.stringify({ hello: 'world', runtime: 'deno' }));",
});

console.log(res);


