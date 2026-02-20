import { VmSpec, VmWith, VmWithInstance } from "freestyle-sandboxes";

export type VmPtyOptions = {
  installTmux?: boolean;
  defaultWorkdir?: string;
  applyDefaultTmuxConfig?: boolean;
};

export type PtySize = {
  cols: number;
  rows: number;
};

export type CreatePtySessionOptions = {
  id: string;
  command?: string;
  cwd?: string;
  envs?: Record<string, string>;
  ptySize?: PtySize;
  reset?: boolean;
};

export type PtySessionInfo = {
  id: string;
  active: boolean;
  cwd: string;
  cols: number;
  rows: number;
  createdAt: number;
};

export type PtyReadOptions = {
  lines?: number;
  includeEscape?: boolean;
};

export type PtyWaitOptions = {
  timeoutMs?: number;
  pollIntervalMs?: number;
  lines?: number;
  onData?: (data: string) => void;
};

export type PtyWaitResult = {
  exitCode: number | null;
  error?: string;
  output?: string;
};

export type VmPtySessionOptions = {
  sessionId: string;
  resetSession?: boolean;
  cols?: number;
  rows?: number;
  envs?: Record<string, string>;
  installTmux?: boolean;
  workdir?: string;
  applyDefaultTmuxConfig?: boolean;
};

export type VmPtySessionLike = {
  attachCommand(readOnly?: boolean): string;
  wrapCommand(command: string, workdir?: string): string;
  wrapServiceCommand(command: string, workdir?: string): string;
  applyToSpec(spec: unknown): unknown;
  captureOutputCommand(options?: PtyReadOptions): string;
};

const DEFAULT_TMUX_CONF = `set -g mouse on
set -g status off`;

export class VmPty extends VmWith<VmPtyInstance> {
  options: Required<VmPtyOptions>;

  constructor(options?: VmPtyOptions) {
    super();
    this.options = {
      installTmux: options?.installTmux ?? true,
      defaultWorkdir: options?.defaultWorkdir ?? "/root",
      applyDefaultTmuxConfig: options?.applyDefaultTmuxConfig ?? true,
    };
  }

  override configureSnapshotSpec(spec: VmSpec): VmSpec {
    if (!this.options.installTmux && !this.options.applyDefaultTmuxConfig) {
      return spec;
    }

    return this.composeSpecs(
      spec,
      new VmSpec({
        aptDeps: this.options.installTmux ? ["tmux"] : undefined,
        additionalFiles: this.options.applyDefaultTmuxConfig
          ? {
              "/root/.tmux.conf": {
                content: DEFAULT_TMUX_CONF,
              },
            }
          : undefined,
      }),
    );
  }

  createInstance(): VmPtyInstance {
    return new VmPtyInstance(this);
  }
}

export class VmPtySession extends VmWith<VmPtySessionInstance> {
  options: Required<
    Pick<
      VmPtySessionOptions,
      | "sessionId"
      | "resetSession"
      | "installTmux"
      | "workdir"
      | "applyDefaultTmuxConfig"
    >
  > &
    Pick<VmPtySessionOptions, "cols" | "rows" | "envs">;

  constructor(options: VmPtySessionOptions) {
    super();
    if (!/^[a-zA-Z0-9._-]+$/.test(options.sessionId)) {
      throw new Error(
        "Invalid PTY session id. Use only letters, numbers, dot, underscore, and hyphen.",
      );
    }

    this.options = {
      sessionId: options.sessionId,
      resetSession: options.resetSession ?? true,
      cols: options.cols,
      rows: options.rows,
      envs: options.envs,
      installTmux: options.installTmux ?? true,
      workdir: options.workdir ?? "/root",
      applyDefaultTmuxConfig: options.applyDefaultTmuxConfig ?? true,
    };
  }

  private shellEscape(value: string): string {
    return `'${value.replace(/'/g, "'\\''")}'`;
  }

  private validateEnvKey(key: string): void {
    if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(key)) {
      throw new Error(`Invalid env var name: ${key}`);
    }
  }

  override configureSnapshotSpec(spec: VmSpec): VmSpec {
    return this.applyToSpec(spec) as VmSpec;
  }

  applyToSpec(spec: unknown): unknown {
    const typedSpec = spec as VmSpec;
    if (!this.options.installTmux && !this.options.applyDefaultTmuxConfig) {
      return typedSpec;
    }

    return this.composeSpecs(
      typedSpec,
      new VmSpec({
        aptDeps: this.options.installTmux ? ["tmux"] : undefined,
        additionalFiles: this.options.applyDefaultTmuxConfig
          ? {
              "/root/.tmux.conf": {
                content: DEFAULT_TMUX_CONF,
              },
            }
          : undefined,
      }),
    );
  }

  createInstance(): VmPtySessionInstance {
    return new VmPtySessionInstance(this);
  }

  attachCommand(readOnly = false): string {
    const flag = readOnly ? "-r " : "";
    return `tmux attach ${flag}-t ${this.options.sessionId}`;
  }

  private buildDetachedTmuxCommand(command: string, workdir?: string): string {
    const envPrefix = Object.entries(this.options.envs ?? {})
      .map(([key, value]) => {
        this.validateEnvKey(key);
        return `${key}=${this.shellEscape(value)}`;
      })
      .join(" ");

    const runCommand = `${envPrefix ? `${envPrefix} ` : ""}${command}`;
    return [
      "tmux new-session -d",
      `-s ${this.shellEscape(this.options.sessionId)}`,
      `-c ${this.shellEscape(workdir ?? this.options.workdir)}`,
      this.options.cols ? `-x ${this.options.cols}` : "",
      this.options.rows ? `-y ${this.options.rows}` : "",
      this.shellEscape(`bash -lc ${this.shellEscape(runCommand)}`),
    ]
      .filter(Boolean)
      .join(" ");
  }

  private buildResetCommand(): string {
    return this.options.resetSession
      ? `tmux has-session -t ${this.shellEscape(this.options.sessionId)} >/dev/null 2>&1 && tmux kill-session -t ${this.shellEscape(this.options.sessionId)} || true`
      : "true";
  }

  wrapCommand(command: string, workdir?: string): string {
    const tmuxCommand = this.buildDetachedTmuxCommand(command, workdir);
    const resetCommand = this.buildResetCommand();

    return `bash -lc ${this.shellEscape(`set -e
${resetCommand}
${tmuxCommand}`)}`;
  }

  wrapServiceCommand(command: string, workdir?: string): string {
    const tmuxCommand = this.buildDetachedTmuxCommand(command, workdir);
    const resetCommand = this.buildResetCommand();

    return `bash -lc ${this.shellEscape(`set -e
${resetCommand}
${tmuxCommand}
while tmux has-session -t ${this.shellEscape(this.options.sessionId)} >/dev/null 2>&1; do
  sleep 1
done`)}`;
  }

  captureOutputCommand(options?: PtyReadOptions): string {
    const lines = options?.lines ?? 200;
    const includeEscape = options?.includeEscape ?? true;
    return [
      "tmux capture-pane",
      includeEscape ? "-e" : "",
      "-p",
      `-t ${this.shellEscape(this.options.sessionId)}`,
      `-S -${lines}`,
    ]
      .filter(Boolean)
      .join(" ");
  }
}

export class VmPtySessionInstance extends VmWithInstance {
  builder: VmPtySession;

  constructor(builder: VmPtySession) {
    super();
    this.builder = builder;
  }

  private shellEscape(value: string): string {
    return `'${value.replace(/'/g, "'\\''")}'`;
  }

  async sendInput(data: string): Promise<ExecResult> {
    return this.vm.exec({
      command: `tmux set-buffer -- ${this.shellEscape(data)} && tmux paste-buffer -d -t ${this.shellEscape(this.builder.options.sessionId)}`,
    });
  }

  async readOutput(options?: PtyReadOptions): Promise<string> {
    const lines = options?.lines ?? 200;
    const includeEscape = options?.includeEscape ?? true;
    const capture = [
      "tmux capture-pane",
      includeEscape ? "-e" : "",
      "-p",
      `-t ${this.shellEscape(this.builder.options.sessionId)}`,
      `-S -${lines}`,
    ]
      .filter(Boolean)
      .join(" ");

    const result = await this.vm.exec({ command: capture });
    return result.stdout ?? "";
  }

  async kill(): Promise<void> {
    await this.vm.exec({
      command: `tmux has-session -t ${this.shellEscape(this.builder.options.sessionId)} >/dev/null 2>&1 && tmux kill-session -t ${this.shellEscape(this.builder.options.sessionId)} || true`,
    });
  }
}

type ExecResult = {
  statusCode?: number | undefined | null;
  stdout?: string | undefined | null;
  stderr?: string | undefined | null;
};

export class VmPtyInstance extends VmWithInstance {
  builder: VmPty;
  private readonly stateDir = "/tmp/freestyle-pty";

  constructor(builder: VmPty) {
    super();
    this.builder = builder;
  }

  private shellEscape(value: string): string {
    return `'${value.replace(/'/g, "'\\''")}'`;
  }

  private validateSessionId(id: string): void {
    if (!/^[a-zA-Z0-9._-]+$/.test(id)) {
      throw new Error(
        "Invalid PTY session id. Use only letters, numbers, dot, underscore, and hyphen.",
      );
    }
  }

  private validateEnvKey(key: string): void {
    if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(key)) {
      throw new Error(`Invalid env var name: ${key}`);
    }
  }

  private async hasPtySession(id: string): Promise<boolean> {
    const result = await this.vm.exec({
      command: `tmux has-session -t ${this.shellEscape(id)}`,
    });

    return result.statusCode === 0;
  }

  private exitCodePath(id: string): string {
    return `${this.stateDir}/${id}.exit`;
  }

  async readExitCode(id: string): Promise<number | null> {
    const path = this.exitCodePath(id);
    const result = await this.vm.exec({
      command: `if [ -f ${this.shellEscape(path)} ]; then cat ${this.shellEscape(path)}; fi`,
    });

    const raw = (result.stdout ?? "").trim();
    if (!raw) {
      return null;
    }

    const value = Number.parseInt(raw, 10);
    return Number.isNaN(value) ? null : value;
  }

  async createPtySession(options: CreatePtySessionOptions): Promise<PtyHandle> {
    this.validateSessionId(options.id);

    const command = options.command ?? "bash -l";
    const cwd = options.cwd ?? this.builder.options.defaultWorkdir;
    const size = options.ptySize;
    const envPrefix = Object.entries(options.envs ?? {})
      .map(([key, value]) => {
        this.validateEnvKey(key);
        return `export ${key}=${this.shellEscape(value)};`;
      })
      .join(" ");
    const exitPath = this.exitCodePath(options.id);

    const wrappedCommand = `${envPrefix} ${command}; __pty_status=$?; printf '%s' "$__pty_status" > ${this.shellEscape(exitPath)}; exit "$__pty_status"`;

    const parts: string[] = [
      `mkdir -p ${this.shellEscape(this.stateDir)}`,
      `rm -f ${this.shellEscape(exitPath)}`,
    ];

    if (options.reset) {
      parts.push(
        `tmux has-session -t ${this.shellEscape(options.id)} >/dev/null 2>&1 && tmux kill-session -t ${this.shellEscape(options.id)} || true`,
      );
    }

    parts.push(
      [
        "tmux new-session -d",
        `-s ${this.shellEscape(options.id)}`,
        `-c ${this.shellEscape(cwd)}`,
        size ? `-x ${size.cols}` : "",
        size ? `-y ${size.rows}` : "",
        this.shellEscape(`bash -lc ${this.shellEscape(wrappedCommand)}`),
      ]
        .filter(Boolean)
        .join(" "),
    );

    const result = await this.vm.exec({ command: parts.join(" && ") });
    if (result.statusCode && result.statusCode !== 0) {
      throw new Error(
        result.stderr ?? `Failed to create PTY session ${options.id}`,
      );
    }

    return new PtyHandle({
      process: this,
      sessionId: options.id,
    });
  }

  async connectPtySession(sessionId: string): Promise<PtyHandle> {
    this.validateSessionId(sessionId);
    const exists = await this.hasPtySession(sessionId);
    if (!exists) {
      throw new Error(`PTY session ${sessionId} not found`);
    }

    return new PtyHandle({
      process: this,
      sessionId,
    });
  }

  async listPtySessions(): Promise<PtySessionInfo[]> {
    const listResult = await this.vm.exec({
      command: "tmux list-sessions -F '#{session_name}' 2>/dev/null || true",
    });

    const ids = (listResult.stdout ?? "")
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter((line) => line.length > 0);

    const infos: PtySessionInfo[] = [];
    for (const id of ids) {
      infos.push(await this.getPtySessionInfo(id));
    }

    return infos;
  }

  async getPtySessionInfo(sessionId: string): Promise<PtySessionInfo> {
    this.validateSessionId(sessionId);
    const active = await this.hasPtySession(sessionId);
    if (!active) {
      throw new Error(`PTY session ${sessionId} not found`);
    }

    const raw = (
      await this.vm.exec({
        command: `tmux display-message -p -t ${this.shellEscape(sessionId)} '#{pane_current_path}\t#{window_width}\t#{window_height}\t#{session_created}'`,
      })
    ).stdout;

    const [cwd = "", width = "80", height = "24", created = "0"] = (raw ?? "")
      .trim()
      .split("\t");

    return {
      id: sessionId,
      active,
      cwd,
      cols: Number.parseInt(width, 10) || 80,
      rows: Number.parseInt(height, 10) || 24,
      createdAt: Number.parseInt(created, 10) || 0,
    };
  }

  async killPtySession(sessionId: string): Promise<void> {
    this.validateSessionId(sessionId);
    await this.vm.exec({
      command: `tmux has-session -t ${this.shellEscape(sessionId)} >/dev/null 2>&1 && tmux kill-session -t ${this.shellEscape(sessionId)} || true`,
    });
  }

  async resizePtySession(
    sessionId: string,
    ptySize: PtySize,
  ): Promise<PtySessionInfo> {
    this.validateSessionId(sessionId);
    await this.vm.exec({
      command: `tmux resize-window -t ${this.shellEscape(sessionId)} -x ${ptySize.cols} -y ${ptySize.rows}`,
    });

    return this.getPtySessionInfo(sessionId);
  }

  async sendInput(sessionId: string, data: string): Promise<ExecResult> {
    this.validateSessionId(sessionId);
    return this.vm.exec({
      command: `tmux set-buffer -- ${this.shellEscape(data)} && tmux paste-buffer -d -t ${this.shellEscape(sessionId)}`,
    });
  }

  async readOutput(
    sessionId: string,
    options?: PtyReadOptions,
  ): Promise<string> {
    this.validateSessionId(sessionId);
    const lines = options?.lines ?? 200;
    const includeEscape = options?.includeEscape ?? true;
    const capture = [
      "tmux capture-pane",
      includeEscape ? "-e" : "",
      "-p",
      `-t ${this.shellEscape(sessionId)}`,
      `-S -${lines}`,
    ]
      .filter(Boolean)
      .join(" ");

    const result = await this.vm.exec({ command: capture });
    return result.stdout ?? "";
  }

  async isSessionConnected(sessionId: string): Promise<boolean> {
    return this.hasPtySession(sessionId);
  }

  attachCommand(options: { sessionId: string; readOnly?: boolean }): string {
    const flag = options.readOnly ? "-r " : "";
    return `tmux attach ${flag}-t ${options.sessionId}`;
  }
}

export class PtyHandle {
  readonly sessionId: string;
  readonly process: VmPtyInstance;
  exitCode: number | null = null;
  error?: string;
  private disconnected = false;

  constructor({
    process,
    sessionId,
  }: {
    process: VmPtyInstance;
    sessionId: string;
  }) {
    this.process = process;
    this.sessionId = sessionId;
  }

  private ensureConnected(): void {
    if (this.disconnected) {
      throw new Error(`PTY handle for ${this.sessionId} is disconnected`);
    }
  }

  async sendInput(data: string): Promise<void> {
    this.ensureConnected();
    const result = await this.process.sendInput(this.sessionId, data);
    if (result.statusCode && result.statusCode !== 0) {
      throw new Error(
        result.stderr ?? `Failed to send input to ${this.sessionId}`,
      );
    }
  }

  async read(options?: PtyReadOptions): Promise<string> {
    this.ensureConnected();
    return this.process.readOutput(this.sessionId, options);
  }

  async resize(ptySize: PtySize): Promise<PtySessionInfo> {
    this.ensureConnected();
    return this.process.resizePtySession(this.sessionId, ptySize);
  }

  async waitForConnection(timeoutMs = 10_000): Promise<void> {
    this.ensureConnected();
    const start = Date.now();
    while (Date.now() - start < timeoutMs) {
      if (await this.process.isSessionConnected(this.sessionId)) {
        return;
      }
      await new Promise((resolve) => setTimeout(resolve, 250));
    }
    throw new Error(
      `Timed out waiting for PTY session ${this.sessionId} connection`,
    );
  }

  async wait(options?: PtyWaitOptions): Promise<PtyWaitResult> {
    this.ensureConnected();
    const timeoutMs = options?.timeoutMs;
    const pollIntervalMs = options?.pollIntervalMs ?? 500;
    const start = Date.now();
    let previousOutput = "";

    while (true) {
      const output = await this.process.readOutput(this.sessionId, {
        lines: options?.lines ?? 300,
        includeEscape: true,
      });

      if (options?.onData) {
        const delta = output.startsWith(previousOutput)
          ? output.slice(previousOutput.length)
          : output;
        if (delta.length > 0) {
          options.onData(delta);
        }
      }
      previousOutput = output;

      const connected = await this.process.isSessionConnected(this.sessionId);
      if (!connected) {
        this.disconnected = true;
        const exitCode = await this.process.readExitCode(this.sessionId);
        this.exitCode = exitCode;
        return {
          exitCode,
          output: previousOutput,
          error: this.error,
        };
      }

      if (timeoutMs !== undefined && Date.now() - start >= timeoutMs) {
        this.error = "Timed out waiting for PTY session completion";
        return {
          exitCode: null,
          output: previousOutput,
          error: this.error,
        };
      }

      await new Promise((resolve) => setTimeout(resolve, pollIntervalMs));
    }
  }

  async kill(): Promise<void> {
    await this.process.killPtySession(this.sessionId);
    this.disconnected = true;
  }

  disconnect(): void {
    this.disconnected = true;
  }

  async isConnected(): Promise<boolean> {
    if (this.disconnected) {
      return false;
    }
    return this.process.isSessionConnected(this.sessionId);
  }
}
