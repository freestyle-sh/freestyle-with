import {
  VmSpec,
  VmWith,
  VmWithInstance,
} from "freestyle-sandboxes";

export type VmK3sOptions = {
  /**
   * K3s version to install (e.g., "v1.28.5+k3s1")
   * If not specified, installs the latest stable version
   */
  version?: string;
  /**
   * Additional k3s server arguments
   */
  serverArgs?: string[];
};

export type VmK3sResolvedOptions = {
  version?: string;
  serverArgs: string[];
};

export interface KubectlResult {
  success: boolean;
  stdout?: string;
  stderr?: string;
  statusCode: number;
}

export interface ApplyManifestResult {
  success: boolean;
  stdout?: string;
  stderr?: string;
}

export class VmK3s extends VmWith<VmK3sInstance> {
  options: VmK3sResolvedOptions;

  constructor(options?: VmK3sOptions) {
    super();
    this.options = {
      version: options?.version,
      serverArgs: options?.serverArgs ?? [],
    };
  }

  override configureSnapshotSpec(spec: VmSpec): VmSpec {
    const versionArg = this.options.version ? `INSTALL_K3S_VERSION=${this.options.version}` : "";
    const serverArgsStr = this.options.serverArgs.length > 0 
      ? `INSTALL_K3S_EXEC="${this.options.serverArgs.join(" ")}"` 
      : "";
    
    const installScript = `#!/bin/bash
set -e

# Install k3s using the official installer
${versionArg} ${serverArgsStr} curl -sfL https://get.k3s.io | sh -

# Wait for k3s to be ready
until kubectl get nodes 2>/dev/null; do
  echo "Waiting for k3s to start..."
  sleep 2
done

echo "K3s is ready!"
kubectl version
`;

    return this.composeSpecs(
      spec,
      new VmSpec({
        additionalFiles: {
          "/opt/install-k3s.sh": {
            content: installScript,
          },
        },
        systemd: {
          services: [
            {
              name: "install-k3s",
              mode: "oneshot",
              deleteAfterSuccess: true,
              exec: ["bash /opt/install-k3s.sh"],
              timeoutSec: 600,
            },
          ],
        },
      }),
    );
  }

  createInstance(): VmK3sInstance {
    return new VmK3sInstance(this);
  }

  installServiceName(): string {
    return "install-k3s.service";
  }
}

export class VmK3sInstance extends VmWithInstance {
  builder: VmK3s;

  constructor(builder: VmK3s) {
    super();
    this.builder = builder;
  }

  /**
   * Execute a kubectl command
   * @param args - kubectl command arguments (e.g., ["get", "pods"])
   * @returns Result with stdout, stderr, and status
   */
  async kubectl(args: string[]): Promise<KubectlResult> {
    const command = `kubectl ${args.join(" ")}`;
    const result = await this.vm.exec({ command });

    return {
      success: result.statusCode === 0,
      stdout: result.stdout ?? undefined,
      stderr: result.stderr ?? undefined,
      statusCode: result.statusCode ?? -1,
    };
  }

  /**
   * Apply a Kubernetes manifest
   * @param manifest - YAML manifest content
   * @returns Result indicating success or failure
   */
  async applyManifest(manifest: string): Promise<ApplyManifestResult> {
    // Use a temporary file to avoid shell injection risks
    const tmpFile = `/tmp/k3s-manifest-${Date.now()}.yaml`;
    const escapedManifest = manifest.replace(/'/g, "'\\''");
    const command = `cat > '${tmpFile}' << 'EOF'\n${manifest}\nEOF\nkubectl apply -f '${tmpFile}' && rm -f '${tmpFile}'`;
    
    const result = await this.vm.exec({ command });

    return {
      success: result.statusCode === 0,
      stdout: result.stdout ?? undefined,
      stderr: result.stderr ?? undefined,
    };
  }

  /**
   * Delete a Kubernetes resource
   * @param resourceType - Type of resource (e.g., "pod", "deployment")
   * @param name - Name of the resource
   * @param namespace - Optional namespace (defaults to "default")
   * @returns Result indicating success or failure
   */
  async deleteResource(
    resourceType: string,
    name: string,
    namespace = "default"
  ): Promise<KubectlResult> {
    return this.kubectl(["delete", resourceType, name, "-n", namespace]);
  }

  /**
   * Get resources as JSON
   * @param resourceType - Type of resource (e.g., "pods", "services")
   * @param namespace - Optional namespace (defaults to "default")
   * @returns Parsed JSON result
   */
  async getResources<T = any>(
    resourceType: string,
    namespace = "default"
  ): Promise<{ success: boolean; data?: T; error?: string }> {
    const result = await this.kubectl([
      "get",
      resourceType,
      "-n",
      namespace,
      "-o",
      "json",
    ]);

    if (!result.success) {
      return {
        success: false,
        error: result.stderr || "Failed to get resources",
      };
    }

    try {
      const data = JSON.parse(result.stdout || "{}");
      return {
        success: true,
        data,
      };
    } catch (e) {
      return {
        success: false,
        error: `Failed to parse JSON: ${e}`,
      };
    }
  }

  /**
   * Get the kubeconfig content
   * @returns Kubeconfig content as string
   */
  async getKubeconfig(): Promise<{ success: boolean; content?: string; error?: string }> {
    const result = await this.vm.exec({
      command: "cat /etc/rancher/k3s/k3s.yaml",
    });

    if (result.statusCode !== 0) {
      return {
        success: false,
        error: result.stderr || "Failed to read kubeconfig",
      };
    }

    return {
      success: true,
      content: result.stdout ?? undefined,
    };
  }

  /**
   * Get cluster info
   * @returns Cluster information
   */
  async getClusterInfo(): Promise<KubectlResult> {
    return this.kubectl(["cluster-info"]);
  }

  /**
   * Get all nodes in the cluster
   * @returns List of nodes
   */
  async getNodes(): Promise<KubectlResult> {
    return this.kubectl(["get", "nodes", "-o", "wide"]);
  }
}
