// import { freestyle, VmTemplate } from "freestyle-sandboxes";
// import { VmNodeJs } from "..";

// const { repoId } = await freestyle.git.repos.create({
//   import: {
//     type: "git",
//     url: "https://github.com/freestyle-sh/freestyle-next",
//     commitMessage: "Initial commit",
//   },
// });

// const template = new VmTemplate({
//   gitRepos: [
//     {
//       repo: "https://github.com/freestyle-sh/freestyle-next",
//       path: "/dev-server/repo",
//     },
//   ],
//   with: {},
// });

// const js = new VmNodeJs({
//   packages: {
//     preview: {
//       install: true,
//       workdir: "/dev-server/repo",
//       tasks: {
//         dev: {
//           pkgScript: "dev",
//           restart: true,
//         },
//       },
//     },
//   },
// });

// const git = new VmGit({
//   repos: {
//     preview: {
//       repo: repoId,
//       path: "/dev-server/repo",
//     },
//     internal: {
//       repo: "https://github.com/your-org/internal-scripts-repo",
//       path: "/internal/repo",
//     },
//   },
// });

// const { vm } = await freestyle.vms.create({
//   template: template,
//   users: [
//     {
//       name: "dev-server",
//     },
//     {
//       name: "internal",
//       groups: ["dev-server"],
//     },
//   ],
//   with: {
//     git,
//     js,
//   },
//   recreate: true,
// });

// // update internal repo
// await vm.git.internal.pull();

// // run internal scripts
// await vm.internal.pkg.runScript("sync-preview");

// // get logs for preview
// for await (const data of vm.preview.tasks.dev.streamLogs()) {
//   console.log(data);
// }

// // execute scripts in the main project
// const result = await vm.project.pkg.runScript("test");
