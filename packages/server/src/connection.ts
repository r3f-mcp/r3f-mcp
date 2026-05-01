import { randomUUID } from 'crypto';
import { createRequire } from 'module';
import type WebSocket from 'ws';
import type {
  SerializedNode,
  ServerToClientMessage,
  ClientToServerMessage,
  SetTransformMessage,
  SetMaterialMessage,
  AddObjectPayload,
  BoundsResult,
  DistanceResult,
  FrustumResult,
  AnimationInfo,
  AnimationControlResult,
  PhysicsResult,
  PerformanceResult,
  ProfileResult,
  InjectionEntry,
} from './types.js';

// ─── Public input types (message payloads minus the id field) ─────────────────

export type TransformInput = Omit<SetTransformMessage['payload'], 'id'>;
export type MaterialInput  = Omit<SetMaterialMessage['payload'],  'id'>;

// ─── Internal types ───────────────────────────────────────────────────────────

// ws v8 has an ESM wrapper (wrapper.mjs) that only re-exports named bindings.
// The default export in ESM is just the WebSocket class and does NOT carry
// WebSocketServer as a property. We use createRequire to load the CJS version
// of ws which exposes all properties, including WebSocketServer.
type RawData = Buffer | ArrayBuffer | Buffer[];

/** Minimal interface for ws.Server — only what we actually call. */
interface WSSInstance {
  on(event: 'connection', cb: (socket: WebSocket) => void): this;
  on(event: 'error',      cb: (err: Error)          => void): this;
  once(event: 'listening', cb: () => void):          this;
  once(event: 'error',     cb: (err: Error) => void): this;
  close(cb?: () => void): void;
}

interface PendingRequest {
  resolve: (msg: ClientToServerMessage) => void;
  reject:  (err: Error) => void;
  timer:   ReturnType<typeof setTimeout>;
}

// ─── Handshake protocol ───────────────────────────────────────────────────────
//
// Problem: Claude Desktop's internal WebKit networking process connects to any
// WebSocket it discovers, stealing the only client slot before the real browser
// app can connect.
//
// Fix: every new connection must send this message within HANDSHAKE_TIMEOUT_MS
// to be accepted as the active client.  WebKit never sends it so it times out
// and is cleanly disconnected.  The real browser (via SceneBridge) sends it
// immediately on open.

const HANDSHAKE_TIMEOUT_MS = 5_000;

interface HandshakeMessage {
  type: 'handshake';
  client: 'r3f-mcp-provider';
}

function isHandshake(msg: unknown): msg is HandshakeMessage {
  return (
    typeof msg === 'object' &&
    msg !== null &&
    (msg as Record<string, unknown>)['type'] === 'handshake' &&
    (msg as Record<string, unknown>)['client'] === 'r3f-mcp-provider'
  );
}

// ─── Config ───────────────────────────────────────────────────────────────────

const REQUEST_TIMEOUT_MS = 10_000;

// Load ws via CJS require so we get the full module.exports object that
// includes WebSocketServer. Node.js's ESM wrapper for ws doesn't attach
// WebSocketServer to the default export.
const _require = createRequire(import.meta.url);
const { WebSocketServer } = _require('ws') as {
  WebSocketServer: new (opts: { port: number }) => WSSInstance;
};

export interface WebSocketManagerOptions {
  /** Port for the WebSocket server. Default: 3333 */
  port: number;
}

// ─── WebSocketManager ─────────────────────────────────────────────────────────

/**
 * Runs a WebSocket **server** that the MCPProvider (browser) connects to.
 * Provides a typed async API for each MCP tool — all requestId correlation
 * and timeout logic lives here so callers just `await` a Promise.
 *
 * Architecture:
 *   Claude / Cursor
 *     ↕ MCP stdio
 *   WebSocketManager   ← this class, Node.js process
 *     ↕ ws://localhost:PORT
 *   SceneBridge inside MCPProvider   ← browser, inside R3F <Canvas>
 */
export class WebSocketManager {
  private readonly port: number;
  private wss: WSSInstance | null = null;
  /** The single authenticated browser client. */
  private client: WebSocket | null = null;
  /**
   * Connections that have opened but have not yet sent a valid handshake.
   * Value is the timeout handle that will close the socket if it stays silent.
   */
  private readonly pendingSockets = new Map<WebSocket, ReturnType<typeof setTimeout>>();

  /**
   * In-flight requests keyed by requestId. Each entry holds resolve/reject
   * callbacks plus a timeout handle, enabling multiple concurrent requests.
   */
  private readonly pending = new Map<string, PendingRequest>();

  /** Snapshot stored by scene_graph and scene_diff tools for diffing. */
  private lastSnapshot: { scene: SerializedNode; timestamp: string } | null = null;

  /**
   * Code registry for injected preview components.
   * Keyed by injection name — populated when inject_code confirms success.
   * Used by commit_component to write code to disk.
   */
  private injectionRegistry = new Map<
    string,
    { name: string; code: string; uuid: string; injectedAt: string }
  >();

  constructor(options: WebSocketManagerOptions) {
    this.port = options.port;
  }

  storeSnapshot(scene: SerializedNode): void {
    this.lastSnapshot = { scene, timestamp: new Date().toISOString() };
  }

  getLastSnapshot(): { scene: SerializedNode; timestamp: string } | null {
    return this.lastSnapshot;
  }

  // ─── Lifecycle ──────────────────────────────────────────────────────────────

  /** Bind the port and start accepting browser connections. */
  listen(): Promise<void> {
    return new Promise((resolve, reject) => {
      const wss = new WebSocketServer({ port: this.port });
      this.wss = wss;

      wss.once('listening', () => {
        log(`WebSocket server listening on ws://localhost:${this.port}`);
        resolve();
      });

      // 'error' fires before 'listening' when the port is already in use.
      wss.once('error', (err) => {
        reject(new Error(`WebSocket server failed to start: ${err.message}`));
      });

      wss.on('connection', (socket: WebSocket) => {
        // Every new connection starts in the pending set.  It only graduates to
        // the active client slot once it sends the identification handshake.
        // Non-r3f-mcp connections (e.g. Claude Desktop's WebKit process) never
        // send it, so they time out and are cleanly dropped.
        const handshakeTimer = setTimeout(() => {
          if (!this.pendingSockets.has(socket)) return; // raced with close
          this.pendingSockets.delete(socket);
          log('Dropped unauthenticated connection (handshake timeout)');
          socket.close(1008, 'Handshake timeout');
        }, HANDSHAKE_TIMEOUT_MS);

        this.pendingSockets.set(socket, handshakeTimer);

        socket.on('message', (raw) => {
          const text = decodeRawData(raw as RawData);

          if (this.pendingSockets.has(socket)) {
            // Pre-auth: only act on the handshake; ignore everything else.
            this.handleHandshake(socket, text);
          } else if (this.client === socket) {
            // Authenticated: route to the normal request/response dispatcher.
            this.handleIncoming(text);
          }
        });

        socket.on('close', (code, reason) => {
          const handshakeTimer = this.pendingSockets.get(socket);
          if (handshakeTimer !== undefined) {
            // Socket closed before it finished handshaking — tidy up.
            clearTimeout(handshakeTimer);
            this.pendingSockets.delete(socket);
            return;
          }

          if (this.client === socket) {
            log(`Browser client disconnected (${code}: ${(reason as Buffer).toString() || '—'})`);
            this.client = null;
            this.rejectAll(new Error('Browser client disconnected'));
          }
        });

        socket.on('error', (err) => {
          log(`Client socket error: ${(err as Error).message}`);
        });
      });
    });
  }

  /** Close the server and reject all pending requests. */
  close(): Promise<void> {
    this.rejectAll(new Error('Server is closing'));

    // Drop all connections that never handshaked.
    for (const [socket, timer] of this.pendingSockets) {
      clearTimeout(timer);
      socket.close(1001, 'Server shutting down');
    }
    this.pendingSockets.clear();

    if (this.client) {
      this.client.close(1001, 'Server shutting down');
      this.client = null;
    }

    return new Promise((resolve) => {
      if (!this.wss) { resolve(); return; }
      this.wss.close(() => resolve());
      this.wss = null;
    });
  }

  // ─── Handshake ───────────────────────────────────────────────────────────────

  private handleHandshake(socket: WebSocket, raw: string): void {
    let msg: unknown;
    try { msg = JSON.parse(raw); } catch { return; }

    if (!isHandshake(msg)) return; // ignore non-handshake messages from pending sockets

    // Cancel the timeout — this socket authenticated in time.
    const timer = this.pendingSockets.get(socket);
    if (timer !== undefined) clearTimeout(timer);
    this.pendingSockets.delete(socket);

    // If there is already an authenticated client (e.g. a previous browser tab
    // or a hot-reload that didn't clean up), replace it.  We set this.client to
    // null BEFORE closing the old socket so the close-event handler for the old
    // socket sees this.client !== old and does not null out the incoming client.
    if (this.client !== null) {
      log('Replacing existing client with newly authenticated connection');
      const old = this.client;
      this.client = null;
      this.rejectAll(new Error('Connection replaced by new client'));
      old.close(1001, 'Replaced by new connection');
    }

    this.client = socket;
    log('Browser client authenticated');
  }

  // ─── Core request/response ────────────────────────────────────────────────

  /**
   * Send a typed command to the browser and await the matching response.
   * Rejects after REQUEST_TIMEOUT_MS if no response arrives.
   */
  private sendRequest(
    message: ServerToClientMessage,
    timeoutMs = REQUEST_TIMEOUT_MS,
  ): Promise<ClientToServerMessage> {
    return new Promise((resolve, reject) => {
      // readyState 1 = OPEN (WebSocket spec constant)
      if (!this.client || this.client.readyState !== 1) {
        reject(new Error(
          'No browser client connected. ' +
          'Make sure <MCPProvider> is mounted inside your <Canvas>.',
        ));
        return;
      }

      const timer = setTimeout(() => {
        this.pending.delete(message.requestId);
        reject(new Error(
          `Request timed out after ${timeoutMs / 1000}s ` +
          `(type=${message.type}, id=${message.requestId})`,
        ));
      }, timeoutMs);

      this.pending.set(message.requestId, { resolve, reject, timer });

      try {
        this.client.send(JSON.stringify(message));
      } catch (err) {
        clearTimeout(timer);
        this.pending.delete(message.requestId);
        reject(err instanceof Error ? err : new Error(String(err)));
      }
    });
  }

  private handleIncoming(raw: string): void {
    let msg: ClientToServerMessage;
    try {
      msg = JSON.parse(raw) as ClientToServerMessage;
    } catch {
      log(`Received invalid JSON: ${raw.slice(0, 120)}`);
      return;
    }

    const req = this.pending.get(msg.requestId);
    if (!req) return; // stale, duplicate, or unsolicited

    clearTimeout(req.timer);
    this.pending.delete(msg.requestId);

    if (msg.type === 'error') {
      const code = msg.payload.code ? ` [${msg.payload.code}]` : '';
      req.reject(new Error(`${msg.payload.message}${code}`));
    } else {
      req.resolve(msg);
    }
  }

  /** Atomically reject and discard all in-flight requests. */
  private rejectAll(err: Error): void {
    const entries = [...this.pending.values()];
    this.pending.clear();
    for (const { timer, reject } of entries) {
      clearTimeout(timer);
      reject(err);
    }
  }

  // ─── Public request API ───────────────────────────────────────────────────

  /** Fetch a complete serialized snapshot of the Three.js scene graph. */
  async requestSceneGraph(): Promise<SerializedNode> {
    const resp = await this.sendRequest({
      type: 'get_scene_graph',
      requestId: randomUUID(),
    });
    if (resp.type !== 'scene_graph_response') {
      throw new Error(`Protocol error: expected scene_graph_response, got ${resp.type}`);
    }
    return resp.payload.scene;
  }

  /**
   * Fetch a single object by UUID or name.
   * Returns null when no object matches — does not throw.
   */
  async requestObject(identifier: string): Promise<SerializedNode | null> {
    const resp = await this.sendRequest({
      type: 'get_object',
      requestId: randomUUID(),
      payload: { id: identifier },
    });
    if (resp.type !== 'object_response') {
      throw new Error(`Protocol error: expected object_response, got ${resp.type}`);
    }
    return resp.payload.object;
  }

  /** Apply a partial transform to an object. Returns true on success. */
  async requestTransformEdit(
    identifier: string,
    transform: TransformInput,
  ): Promise<boolean> {
    const resp = await this.sendRequest({
      type: 'set_transform',
      requestId: randomUUID(),
      payload: { id: identifier, ...transform },
    });
    if (resp.type !== 'edit_confirmation') {
      throw new Error(`Protocol error: expected edit_confirmation, got ${resp.type}`);
    }
    return resp.payload.success;
  }

  /** Apply material property overrides to an object. Returns true on success. */
  async requestMaterialEdit(
    identifier: string,
    properties: MaterialInput,
  ): Promise<boolean> {
    const resp = await this.sendRequest({
      type: 'set_material',
      requestId: randomUUID(),
      payload: { id: identifier, ...properties },
    });
    if (resp.type !== 'edit_confirmation') {
      throw new Error(`Protocol error: expected edit_confirmation, got ${resp.type}`);
    }
    return resp.payload.success;
  }

  /** Toggle the visibility of an object. Returns true on success. */
  async requestVisibilityEdit(
    identifier: string,
    visible: boolean,
  ): Promise<boolean> {
    const resp = await this.sendRequest({
      type: 'set_visible',
      requestId: randomUUID(),
      payload: { id: identifier, visible },
    });
    if (resp.type !== 'edit_confirmation') {
      throw new Error(`Protocol error: expected edit_confirmation, got ${resp.type}`);
    }
    return resp.payload.success;
  }

  /**
   * Capture a screenshot of the current frame.
   * Returns a raw base64-encoded JPEG string (no data-URL prefix).
   */
  async requestScreenshot(width?: number, height?: number): Promise<string> {
    const resp = await this.sendRequest({
      type: 'take_screenshot',
      requestId: randomUUID(),
      payload: { width, height },
    });
    if (resp.type !== 'screenshot_response') {
      throw new Error(`Protocol error: expected screenshot_response, got ${resp.type}`);
    }
    return resp.payload.image;
  }

  /** Create a new object in the scene. Returns the UUID and name of the created object. */
  async requestAddObject(payload: AddObjectPayload): Promise<{ uuid: string; name: string }> {
    const resp = await this.sendRequest({
      type: 'add_object',
      requestId: randomUUID(),
      payload,
    });
    if (resp.type !== 'add_object_response') {
      throw new Error(`Protocol error: expected add_object_response, got ${resp.type}`);
    }
    return resp.payload;
  }

  /** Remove an object (and its children) from the scene by UUID or name. */
  async requestRemoveObject(identifier: string): Promise<{ uuid: string; name: string }> {
    const resp = await this.sendRequest({
      type: 'remove_object',
      requestId: randomUUID(),
      payload: { id: identifier },
    });
    if (resp.type !== 'remove_object_response') {
      throw new Error(`Protocol error: expected remove_object_response, got ${resp.type}`);
    }
    return resp.payload;
  }

  /** Get the world-space axis-aligned bounding box of an object. */
  async requestQueryBounds(identifier: string): Promise<BoundsResult> {
    const resp = await this.sendRequest({
      type: 'query_bounds',
      requestId: randomUUID(),
      payload: { id: identifier },
    });
    if (resp.type !== 'query_bounds_response') {
      throw new Error(`Protocol error: expected query_bounds_response, got ${resp.type}`);
    }
    return resp.payload;
  }

  /** Measure world-space distance between two objects. */
  async requestQueryDistance(fromId: string, toId: string): Promise<DistanceResult> {
    const resp = await this.sendRequest({
      type: 'query_distance',
      requestId: randomUUID(),
      payload: { fromId, toId },
    });
    if (resp.type !== 'query_distance_response') {
      throw new Error(`Protocol error: expected query_distance_response, got ${resp.type}`);
    }
    return resp.payload;
  }

  /** List all objects visible in the camera frustum. */
  async requestQueryFrustum(cameraId?: string): Promise<FrustumResult> {
    const resp = await this.sendRequest({
      type: 'query_frustum',
      requestId: randomUUID(),
      payload: { cameraId },
    });
    if (resp.type !== 'query_frustum_response') {
      throw new Error(`Protocol error: expected query_frustum_response, got ${resp.type}`);
    }
    return resp.payload;
  }

  // ─── v0.3 ─────────────────────────────────────────────────────────────────

  /** List all active animations in the scene. */
  async requestGetAnimations(identifier?: string): Promise<{ animations: AnimationInfo[]; totalAnimations: number }> {
    const resp = await this.sendRequest({
      type: 'get_animations',
      requestId: randomUUID(),
      payload: { identifier },
    });
    if (resp.type !== 'animations_response') {
      throw new Error(`Protocol error: expected animations_response, got ${resp.type}`);
    }
    return resp.payload;
  }

  /** Play, pause, stop, or seek an animation. */
  async requestControlAnimation(
    target: string,
    action: 'play' | 'pause' | 'stop' | 'seek',
    time?: number,
    animationName?: string,
  ): Promise<AnimationControlResult> {
    const resp = await this.sendRequest({
      type: 'control_animation',
      requestId: randomUUID(),
      payload: { target, action, time, animationName },
    });
    if (resp.type !== 'animation_control_response') {
      throw new Error(`Protocol error: expected animation_control_response, got ${resp.type}`);
    }
    return resp.payload;
  }

  /** Read the Rapier physics world state. */
  async requestGetPhysics(identifier?: string): Promise<PhysicsResult> {
    const resp = await this.sendRequest({
      type: 'get_physics',
      requestId: randomUUID(),
      payload: { identifier },
    });
    if (resp.type !== 'physics_response') {
      throw new Error(`Protocol error: expected physics_response, got ${resp.type}`);
    }
    return resp.payload;
  }

  /** Get a single-frame performance snapshot. */
  async requestGetPerformance(): Promise<PerformanceResult> {
    const resp = await this.sendRequest({
      type: 'get_performance',
      requestId: randomUUID(),
    });
    if (resp.type !== 'performance_response') {
      throw new Error(`Protocol error: expected performance_response, got ${resp.type}`);
    }
    return resp.payload;
  }

  /**
   * Run a profiling session for `durationSec` seconds and return aggregated stats.
   * Uses an extended timeout (duration + 10 s) so the request never races the profile.
   */
  async requestGetPerformanceProfile(durationSec: number): Promise<ProfileResult> {
    const timeoutMs = (durationSec + 10) * 1000;
    const resp = await this.sendRequest(
      {
        type: 'start_profile',
        requestId: randomUUID(),
        payload: { duration: durationSec },
      },
      timeoutMs,
    );
    if (resp.type !== 'profile_response') {
      throw new Error(`Protocol error: expected profile_response, got ${resp.type}`);
    }
    return resp.payload;
  }

  // ─── v0.4: Live injection ──────────────────────────────────────────────────

  /**
   * Inject component code into the browser for immediate live preview.
   * On success, the code is stored in the registry for later commit.
   */
  async requestInjectCode(
    code: string,
    name: string,
    replace?: string,
  ): Promise<{ success: boolean; uuid: string; name: string; error?: string }> {
    const resp = await this.sendRequest({
      type: 'inject_code',
      requestId: randomUUID(),
      payload: { code, name, replace },
    });
    if (resp.type !== 'inject_code_response') {
      throw new Error(`Protocol error: expected inject_code_response, got ${resp.type}`);
    }
    const { payload } = resp;
    // Register the code so commit_component can write it later.
    if (payload.success) {
      this.injectionRegistry.set(name, {
        name,
        code,
        uuid: payload.uuid,
        injectedAt: new Date().toISOString(),
      });
      // When replacing, remove the old entry too.
      if (replace && replace !== name) this.injectionRegistry.delete(replace);
    }
    return payload;
  }

  /** Remove a live preview injection from the browser. */
  async requestRemoveInjection(name: string): Promise<{ success: boolean; name: string }> {
    const resp = await this.sendRequest({
      type: 'remove_injection',
      requestId: randomUUID(),
      payload: { name },
    });
    if (resp.type !== 'injection_removed_response') {
      throw new Error(`Protocol error: expected injection_removed_response, got ${resp.type}`);
    }
    this.injectionRegistry.delete(name);
    return resp.payload;
  }

  /** List all currently active live preview injections. */
  async requestListInjections(): Promise<InjectionEntry[]> {
    const resp = await this.sendRequest({
      type: 'get_injections',
      requestId: randomUUID(),
    });
    if (resp.type !== 'injections_list_response') {
      throw new Error(`Protocol error: expected injections_list_response, got ${resp.type}`);
    }
    return resp.payload.injections;
  }

  /**
   * Retrieve an injection's source code from the registry.
   * Used by commit_component to write it to disk.
   */
  getInjectionCode(name: string): { code: string; uuid: string } | null {
    const entry = this.injectionRegistry.get(name);
    return entry ? { code: entry.code, uuid: entry.uuid } : null;
  }

  getInjectionRegistry(): ReadonlyMap<
    string,
    { name: string; code: string; uuid: string; injectedAt: string }
  > {
    return this.injectionRegistry;
  }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Normalise the ws RawData union (Buffer | ArrayBuffer | Buffer[]) to UTF-8. */
function decodeRawData(data: RawData): string {
  if (Buffer.isBuffer(data)) return data.toString('utf8');
  if (Array.isArray(data))   return Buffer.concat(data).toString('utf8');
  return Buffer.from(data as ArrayBuffer).toString('utf8');
}

/** All operational logging goes to stderr — stdout belongs to the MCP protocol. */
function log(msg: string): void {
  console.error(`[r3f-mcp] ${msg}`);
}
