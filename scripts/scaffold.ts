import { mkdirSync, writeFileSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { execSync } from "node:child_process";

const name = process.argv[2];

if (!name) {
  console.error("Usage: pnpm scaffold <name>");
  console.error("Example: pnpm scaffold redis");
  process.exit(1);
}

const packageName = `with-${name}`;
// Convert kebab-case to PascalCase for class name
const pascalName = name
  .split("-")
  .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
  .join("");
const className = `Vm${pascalName}`;
const instanceClassName = `${className}Instance`;
const dir = join(process.cwd(), packageName);

// Create directories
mkdirSync(dir, { recursive: true });
mkdirSync(join(dir, "src"), { recursive: true });
mkdirSync(join(dir, "examples"), { recursive: true });

// package.json
const packageJson = {
  name: `@freestyle-sh/${packageName}`,
  version: "0.0.1",
  packageManager: "pnpm@10.11.0",
  private: false,
  dependencies: {
    "freestyle-sandboxes": "^0.1.14",
  },
  devDependencies: {
    "@types/node": "^22.0.0",
    pkgroll: "^2.11.2",
    typescript: "^5.8.3",
  },
  type: "module",
  main: "./dist/index.js",
  types: "./dist/index.d.ts",
  exports: {
    ".": {
      types: "./dist/index.d.ts",
      import: "./dist/index.js",
    },
  },
  source: "./src/index.ts",
  files: ["dist"],
  scripts: {
    build: "pkgroll",
    prepublishOnly: "pnpm run build",
  },
};

writeFileSync(join(dir, "package.json"), JSON.stringify(packageJson, null, 2) + "\n");

// tsconfig.json
const tsconfig = {
  compilerOptions: {
    target: "ES2022",
    module: "ESNext",
    moduleResolution: "bundler",
    strict: true,
    esModuleInterop: true,
    skipLibCheck: true,
    forceConsistentCasingInFileNames: true,
    declaration: true,
    declarationMap: true,
    outDir: "./dist",
  },
  include: ["src/index.ts"],
  exclude: ["node_modules", "dist", "examples"],
};

writeFileSync(join(dir, "tsconfig.json"), JSON.stringify(tsconfig, null, 2) + "\n");

// src/index.ts
const indexTs = `import {
  VmSpec,
  VmWith,
  VmWithInstance,
} from "freestyle-sandboxes";

export type ${className}Options = {
  // Add your options here
};

export type ${className}ResolvedOptions = {
  // Add your resolved options here
};

export class ${className} extends VmWith<${instanceClassName}> {
  options: ${className}ResolvedOptions;

  constructor(options?: ${className}Options) {
    super();
    this.options = {
      // Resolve options here
    };
  }

  override configureSnapshotSpec(spec: VmSpec): VmSpec {
    return this.composeSpecs(
      spec,
      new VmSpec({
        additionalFiles: {
          // Add files here
        },
        systemd: {
          services: [
            // Add services here
          ],
        },
      }),
    );
  }

  createInstance(): ${instanceClassName} {
    return new ${instanceClassName}(this);
  }

  installServiceName(): string {
    return "install-${name}.service";
  }
}

class ${instanceClassName} extends VmWithInstance {
  builder: ${className};

  constructor(builder: ${className}) {
    super();
    this.builder = builder;
  }

  // Add instance methods here
}
`;

writeFileSync(join(dir, "src/index.ts"), indexTs);

// .env (empty placeholder)
writeFileSync(join(dir, ".env"), "");

// Add to pnpm-workspace.yaml
const workspacePath = join(process.cwd(), "pnpm-workspace.yaml");
const workspaceContent = readFileSync(workspacePath, "utf-8");
const lines = workspaceContent.split("\n");
const typesIndex = lines.findIndex((line) => line.includes("types/*"));
if (typesIndex !== -1) {
  lines.splice(typesIndex, 0, `  - "${packageName}"`);
} else {
  // Append before last empty line if types/* not found
  const lastNonEmpty = lines.findLastIndex((line) => line.trim() !== "");
  lines.splice(lastNonEmpty + 1, 0, `  - "${packageName}"`);
}
writeFileSync(workspacePath, lines.join("\n"));

console.log(`Created ${packageName}/`);
console.log(`  - package.json`);
console.log(`  - tsconfig.json`);
console.log(`  - src/index.ts`);
console.log(`  - examples/`);
console.log(`  - .env`);
console.log(`  - Added to pnpm-workspace.yaml`);
console.log();

// Run pnpm install
console.log("Running pnpm install...");
execSync("pnpm install", { stdio: "inherit" });
