import { VmNodeJs } from "@freestyle-sh/with-nodejs";
import type { VmPtySessionLike } from "@freestyle-sh/with-pty";
import { VmSpec, VmWith, VmWithInstance } from "freestyle-sandboxes";

export const createSnapshotSpec = (
  templateRepo: string,
  workdir: string,
  devCommand?: string,
  devCommandPty?: VmPtySessionLike,
): VmSpec => {
  const resolvedDevCommand = devCommandPty
    ? devCommandPty.wrapServiceCommand(devCommand ?? "npm run dev", workdir)
    : (devCommand ?? "npm run dev");

  let newSpec = new VmSpec({
    with: {
      nodejs: new VmNodeJs({}),
    },
    git: {
      repos: [
        {
          repo: templateRepo,
          path: workdir,
        },
      ],
    },
    systemd: {
      services: [
        {
          name: "npm-install",
          bash: "npm install",
          mode: "oneshot",
          workdir: workdir,
        },
        {
          name: "npm-dev",
          bash: resolvedDevCommand,
          after: ["npm-install"],
          requires: ["npm-install"],
          workdir: workdir,
        },
        {
          name: "curl-test",
          bash: `
set -e
timeout 10 bash -c 'while ! curl http://localhost:3000; do
  echo "Retrying..."
  sleep 1
done'
`,
          mode: "oneshot",
          after: ["npm-dev"],
          requires: ["npm-dev"],
          workdir: workdir,
          timeoutSec: 10,
        },
      ],
    },
  });

  if (devCommandPty) {
    newSpec = devCommandPty.applyToSpec(newSpec) as VmSpec;
  }

  return newSpec;
};

export class VmDevServerInstance extends VmWithInstance {
  options: {
    workdir: string;
    devCommandPty?: VmPtySessionLike;
  };
  constructor(options: { workdir: string; devCommandPty?: VmPtySessionLike }) {
    super();
    this.options = options;
  }

  private shellEscape(value: string): string {
    return `'${value.replace(/'/g, "'\\''")}'`;
  }

  private buildJournalctlCommand(options: {
    unit?: string;
    lines?: number;
    since?: string;
    afterCursor?: string;
    showCursor?: boolean;
    output?: string;
  }): string {
    const unit = options.unit ?? "npm-dev";
    const parts = ["journalctl", "-u", this.shellEscape(unit), "--no-pager"];

    if (options.output) {
      parts.push("-o", this.shellEscape(options.output));
    }

    if (options.lines !== undefined) {
      parts.push("-n", String(options.lines));
    }

    if (options.since) {
      parts.push("--since", this.shellEscape(options.since));
    }

    if (options.afterCursor) {
      parts.push("--after-cursor", this.shellEscape(options.afterCursor));
    }

    if (options.showCursor) {
      parts.push("--show-cursor");
    }

    return parts.join(" ");
  }

  async getLogs(options?: {
    unit?: string;
    lines?: number;
    since?: string;
  }): Promise<{
    statusCode?: number | undefined | null;
    stdout?: string | undefined | null;
    stderr?: string | undefined | null;
  }> {
    const pty = this.options.devCommandPty;
    const shouldUsePtyLogs =
      pty && (options?.unit === undefined || options.unit === "npm-dev");

    if (shouldUsePtyLogs) {
      return await this.vm.exec({
        command: pty.captureOutputCommand({
          lines: options?.lines ?? 200,
          includeEscape: true,
        }),
      });
    }

    const command = this.buildJournalctlCommand({
      unit: options?.unit,
      lines: options?.lines ?? 200,
      since: options?.since,
    });

    return await this.vm.exec({ command });
  }

  async *streamLogs(options?: {
    unit?: string;
    lines?: number;
    since?: string;
    pollIntervalMs?: number;
    signal?: AbortSignal;
  }): AsyncGenerator<string> {
    const pty = this.options.devCommandPty;
    const shouldUsePtyLogs =
      pty && (options?.unit === undefined || options.unit === "npm-dev");

    if (shouldUsePtyLogs) {
      const pollIntervalMs = options?.pollIntervalMs ?? 1000;
      let previousOutput = "";

      const sleep = (ms: number) =>
        new Promise((resolve) => setTimeout(resolve, ms));

      while (true) {
        if (options?.signal?.aborted) {
          return;
        }

        const result = await this.vm.exec({
          command: pty.captureOutputCommand({
            lines: options?.lines ?? 200,
            includeEscape: true,
          }),
        });

        if (result.statusCode && result.statusCode !== 0) {
          const error = result.stderr ?? "Failed to read PTY logs";
          throw new Error(error);
        }

        const output = result.stdout ?? "";
        const delta = output.startsWith(previousOutput)
          ? output.slice(previousOutput.length)
          : output;

        for (const line of delta.split(/\r?\n/)) {
          if (!line) {
            continue;
          }
          yield line;
        }

        previousOutput = output;
        await sleep(pollIntervalMs);
      }
    }

    const pollIntervalMs = options?.pollIntervalMs ?? 1000;
    let cursor: string | undefined = undefined;
    let first = true;

    const sleep = (ms: number) =>
      new Promise((resolve) => setTimeout(resolve, ms));

    while (true) {
      if (options?.signal?.aborted) {
        return;
      }

      const command = this.buildJournalctlCommand({
        unit: options?.unit,
        lines: first ? (options?.lines ?? 200) : undefined,
        since: first ? options?.since : undefined,
        afterCursor: first ? undefined : cursor,
        showCursor: true,
        output: "cat",
      });

      const result = await this.vm.exec({ command });

      if (result.statusCode && result.statusCode !== 0) {
        const error = result.stderr ?? "Failed to read logs";
        throw new Error(error);
      }

      const output = result.stdout ?? "";
      let nextCursor: string | undefined = cursor;

      for (const line of output.split(/\r?\n/)) {
        if (!line) {
          continue;
        }

        const cursorMatch = line.match(/^-- cursor: (.+)$/);
        if (cursorMatch) {
          nextCursor = cursorMatch[1].trim();
          continue;
        }

        if (line.startsWith("-- No entries")) {
          continue;
        }

        yield line;
      }

      cursor = nextCursor;
      first = false;
      await sleep(pollIntervalMs);
    }
  }

  async restart(): Promise<{
    statusCode?: number | undefined | null;
    stdout?: string | undefined | null;
    stderr?: string | undefined | null;
  }> {
    return await this.vm.exec("systemctl restart npm-dev");
  }
}

export class VmDevServer extends VmWith<VmDevServerInstance> {
  templateRepo?: string;
  repo?: string;
  workdir: string;
  devCommand?: string;
  devCommandPty?: VmPtySessionLike;

  override createInstance(): VmDevServerInstance {
    return new VmDevServerInstance({
      workdir: this.workdir,
      devCommandPty: this.devCommandPty,
    });
  }

  constructor(options: {
    templateRepo?: string;
    repo?: string;
    workdir?: string;
    devCommand?: string;
    devCommandPty?: VmPtySessionLike;
  }) {
    super();
    this.templateRepo = options.templateRepo;
    this.repo = options.repo;
    this.workdir = options.workdir ?? "/repo";
    this.devCommand = options.devCommand;
    this.devCommandPty = options.devCommandPty;
  }

  override configureSnapshotSpec(spec: VmSpec): VmSpec | Promise<VmSpec> {
    if (this.templateRepo) {
      const composed = this.composeSpecs(
        spec,
        createSnapshotSpec(
          this.templateRepo,
          this.workdir,
          this.devCommand,
          this.devCommandPty,
        ),
      );
      return composed;
    }

    return spec;
  }

  override configureSpec(spec: VmSpec): VmSpec | Promise<VmSpec> {
    if (this.repo) {
      const newSpec = new VmSpec({
        git: {
          repos: [
            {
              repo: this.repo,
              path: this.workdir,
            },
          ],
        },
      });

      return this.composeSpecs(spec, newSpec);
    } else {
      return spec;
    }
  }
}
