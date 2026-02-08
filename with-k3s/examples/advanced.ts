import "dotenv/config";
import { freestyle, VmSpec } from "freestyle-sandboxes";
import { VmK3s } from "../src/index.js";

// Create a VM with k3s installed
const spec = new VmSpec({
  with: {
    k3s: new VmK3s(),
  },
});

const { vm, vmId } = await freestyle.vms.create({ spec });

console.log("K3s VM created successfully!");

// Create a complete application with deployment and service
const manifest = `
apiVersion: v1
kind: Namespace
metadata:
  name: demo-app
---
apiVersion: apps/v1
kind: Deployment
metadata:
  name: hello-world
  namespace: demo-app
spec:
  replicas: 2
  selector:
    matchLabels:
      app: hello-world
  template:
    metadata:
      labels:
        app: hello-world
    spec:
      containers:
      - name: hello-world
        image: gcr.io/google-samples/hello-app:1.0
        ports:
        - containerPort: 8080
---
apiVersion: v1
kind: Service
metadata:
  name: hello-world-service
  namespace: demo-app
spec:
  selector:
    app: hello-world
  ports:
  - protocol: TCP
    port: 80
    targetPort: 8080
  type: ClusterIP
`;

console.log("\nApplying complete application manifest...");
const result = await vm.k3s.applyManifest(manifest);
console.log("Apply result:", result.success ? "Success" : "Failed");

// Wait for resources to be created
await new Promise((resolve) => setTimeout(resolve, 3000));

// Check namespace
console.log("\nNamespaces:");
const nsResult = await vm.k3s.kubectl(["get", "namespaces"]);
console.log(nsResult.stdout);

// Check deployments in demo-app namespace
console.log("\nDeployments in demo-app namespace:");
const deployments = await vm.k3s.getResources("deployments", "demo-app");
if (deployments.success && deployments.data) {
  const items = (deployments.data as any).items || [];
  items.forEach((item: any) => {
    console.log(`- ${item.metadata.name}: ${item.status.replicas || 0} replicas`);
  });
}

// Check services
console.log("\nServices in demo-app namespace:");
const services = await vm.k3s.getResources("services", "demo-app");
if (services.success && services.data) {
  const items = (services.data as any).items || [];
  items.forEach((item: any) => {
    console.log(`- ${item.metadata.name}: ${item.spec.clusterIP}`);
  });
}

// Execute a custom kubectl command
console.log("\nGetting all resources:");
const allResources = await vm.k3s.kubectl([
  "get",
  "all",
  "-n",
  "demo-app",
]);
console.log(allResources.stdout);

// Clean up
console.log("\nCleaning up...");
await vm.k3s.kubectl(["delete", "namespace", "demo-app"]);

await freestyle.vms.delete({ vmId });
console.log("VM deleted successfully!");
