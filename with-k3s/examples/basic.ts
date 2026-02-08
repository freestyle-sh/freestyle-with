import "dotenv/config";
import { freestyle, VmSpec } from "freestyle-sandboxes";
import { VmK3s } from "../src/index.js";

const spec = new VmSpec({
  with: {
    k3s: new VmK3s(),
  },
});

const { vm, vmId } = await freestyle.vms.create({ spec });

console.log("K3s VM created successfully!");
console.log("VM ID:", vmId);

// Get cluster info
const clusterInfo = await vm.k3s.getClusterInfo();
console.log("\nCluster Info:");
console.log(clusterInfo.stdout);

// Get nodes
const nodes = await vm.k3s.getNodes();
console.log("\nNodes:");
console.log(nodes.stdout);

// Apply a simple nginx deployment
const nginxManifest = `
apiVersion: apps/v1
kind: Deployment
metadata:
  name: nginx-deployment
  labels:
    app: nginx
spec:
  replicas: 1
  selector:
    matchLabels:
      app: nginx
  template:
    metadata:
      labels:
        app: nginx
    spec:
      containers:
      - name: nginx
        image: nginx:latest
        ports:
        - containerPort: 80
`;

console.log("\nApplying nginx deployment...");
const applyResult = await vm.k3s.applyManifest(nginxManifest);
console.log("Apply result:", applyResult.success ? "Success" : "Failed");
if (applyResult.stdout) {
  console.log(applyResult.stdout);
}
if (applyResult.stderr) {
  console.error(applyResult.stderr);
}

// Wait a bit for the deployment to be processed
await new Promise((resolve) => setTimeout(resolve, 2000));

// Get deployments
const deployments = await vm.k3s.getResources("deployments", "default");
console.log("\nDeployments:");
if (deployments.success && deployments.data) {
  console.log(JSON.stringify(deployments.data, null, 2));
}

// Get pods
const pods = await vm.k3s.kubectl(["get", "pods", "-o", "wide"]);
console.log("\nPods:");
console.log(pods.stdout);

// Get kubeconfig
const kubeconfigResult = await vm.k3s.getKubeconfig();
console.log("\nKubeconfig available:", kubeconfigResult.success);

// Cleanup
console.log("\nCleaning up...");
const deleteResult = await vm.k3s.deleteResource("deployment", "nginx-deployment", "default");
console.log("Delete result:", deleteResult.success ? "Success" : "Failed");

await freestyle.vms.delete({ vmId });
console.log("VM deleted successfully!");
