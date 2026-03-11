/**
 * Type augmentation for @anthropic-ai/claude-agent-sdk DirectConnect exports.
 *
 * The SDK's sdk.mjs already exports DirectConnectTransport, DirectConnectError,
 * and parseDirectConnectUrl at runtime, but sdk.d.ts doesn't declare them.
 * Drop this file into your project and add it to tsconfig "include" or
 * use a triple-slash reference to get the types.
 */

import type { PermissionMode } from "@anthropic-ai/claude-agent-sdk";

declare module "@anthropic-ai/claude-agent-sdk" {
  /**
   * Options for constructing a DirectConnectTransport.
   */
  interface DirectConnectTransportOptions {
    /** HTTP(S) URL of the direct connect server (e.g., "http://localhost:8080") */
    serverUrl: string;
    /** Bearer token for authenticating with the server */
    authToken?: string;
    /** Working directory to pass to the remote session */
    cwd?: string;
    /** Session key for resuming/identifying sessions */
    sessionKey?: string;
    /** Permission mode for the remote session */
    permissionMode?: PermissionMode;
    /** Abort controller for cancelling the connection */
    abortController?: AbortController;
    /** If true, sends DELETE /sessions/:id when the transport is closed */
    deleteSessionOnClose?: boolean;
  }

  /**
   * WebSocket-based transport for connecting to a remote Claude Code instance.
   *
   * Connects to a direct-connect server by:
   * 1. POSTing to `{serverUrl}/sessions` to create a session
   *    (returns `{ session_id, ws_url, work_dir }`)
   * 2. Opening a WebSocket to `ws_url` for bidirectional JSON streaming
   * 3. Optionally DELETEing the session on close
   *
   * @example
   * ```typescript
   * import {
   *   DirectConnectTransport,
   *   parseDirectConnectUrl,
   * } from "@anthropic-ai/claude-agent-sdk";
   *
   * const { serverUrl, authToken } = parseDirectConnectUrl(
   *   "cc://my-server:8080/mytoken",
   * );
   * const transport = new DirectConnectTransport({ serverUrl, authToken });
   *
   * await transport.ready;
   * console.log("Session:", transport.getSessionId());
   * console.log("CWD:", transport.getWorkDir());
   *
   * // write a user message
   * transport.write(JSON.stringify({
   *   type: "user",
   *   session_id: "",
   *   message: { role: "user", content: [{ type: "text", text: "hello" }] },
   *   parent_tool_use_id: null,
   * }) + "\n");
   *
   * // read responses
   * for await (const msg of transport.readMessages()) {
   *   console.log(msg);
   * }
   * ```
   */
  class DirectConnectTransport {
    constructor(options: DirectConnectTransportOptions);

    /**
     * Promise that resolves when the WebSocket connection is open.
     * Rejects on connection failure or 15 s timeout.
     */
    readonly ready: Promise<void>;

    /** Session ID assigned by the server (undefined until ready) */
    getSessionId(): string | undefined;

    /** Working directory reported by the server (undefined until ready) */
    getWorkDir(): string | undefined;

    /** Write a JSON line to the WebSocket */
    write(data: string): void | Promise<void>;

    /** Close the WebSocket and clean up */
    close(): void;

    /** True when the WebSocket is open */
    isReady(): boolean;

    /**
     * Async generator of messages from the remote CLI.
     * Yields the internal StdoutMessage union (SDKMessage | control | keepalive).
     * Cast to `unknown` and narrow on `.type` if you need full control,
     * or just check for the SDKMessage types you care about.
     */
    readMessages(): AsyncGenerator<unknown, void, unknown>;

    /** No-op (stdin concept does not apply to WebSocket transport) */
    endInput(): void;
  }

  /** Error subclass for DirectConnect failures (connection, timeout, protocol) */
  class DirectConnectError extends Error {
    constructor(message: string);
  }

  /** Result of parsing a direct connect URL */
  interface DirectConnectUrlParts {
    /** HTTP(S) server URL (e.g., "http://localhost:8080") */
    serverUrl: string;
    /** Auth token extracted from the URL path, if present */
    authToken: string | undefined;
  }

  /**
   * Parse a direct connect URL into its components.
   *
   * Supported formats:
   * - `cc://host:port`        → `{ serverUrl: "http://host:port", authToken: undefined }`
   * - `cc://host:port/token`  → `{ serverUrl: "http://host:port", authToken: "token" }`
   * - `http(s)://host:port`   → used as-is, no token
   * - `host:port`             → treated as `http://host:port`
   *
   * Throws `DirectConnectError` for `cc+unix://` (unsupported in SDK transport).
   */
  function parseDirectConnectUrl(url: string): DirectConnectUrlParts;
}
