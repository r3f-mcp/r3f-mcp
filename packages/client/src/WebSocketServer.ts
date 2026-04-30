import type {
  ClientToServerMessage,
  ServerToClientMessage,
  GetSceneGraphMessage,
  GetObjectMessage,
  SetTransformMessage,
  SetMaterialMessage,
  SetVisibleMessage,
  TakeScreenshotMessage,
  AddObjectMessage,
  RemoveObjectMessage,
  QueryBoundsMessage,
  QueryDistanceMessage,
  QueryFrustumMessage,
} from './types';

// ─── Public types ─────────────────────────────────────────────────────────────

// Imported for internal use; re-exported for callers.
import type { ConnectionStatus } from './types';
export type { ConnectionStatus };

export interface SceneBridgeOptions {
  /** Port the MCP server's WebSocket is listening on. Default: 3333 */
  port?: number;
  /** Hostname to connect to. Default: 'localhost' */
  host?: string;
  /** Maximum reconnection attempts before giving up. Default: 5 */
  maxRetries?: number;
  /**
   * Delay in ms before the first retry. Each subsequent attempt doubles it
   * (exponential backoff). Default: 250
   * Retry schedule (default): 250 → 500 → 1000 → 2000 → 4000 ms
   */
  baseDelay?: number;
}

type StatusListener = (status: ConnectionStatus, error?: Error) => void;

// ─── Handshake ────────────────────────────────────────────────────────────────
//
// Sent immediately when the WebSocket opens so the server can distinguish the
// real browser app from other processes (e.g. Claude Desktop's WebKit process)
// that may connect to the same port.

const HANDSHAKE = JSON.stringify({ type: 'handshake', client: 'r3f-mcp-provider' });

// ─── SceneBridge ─────────────────────────────────────────────────────────────

/**
 * WebSocket client that connects to the MCP server's WebSocket endpoint from
 * the browser. Provides a typed handler API for each incoming message type and
 * automatic reconnection with exponential backoff.
 */
export class SceneBridge {
  private readonly url: string;
  private readonly maxRetries: number;
  private readonly baseDelay: number;

  private ws: WebSocket | null = null;
  private stopped = false;
  private retryCount = 0;
  private retryTimer: ReturnType<typeof setTimeout> | null = null;
  private sendQueue: ClientToServerMessage[] = [];

  // One slot per server→client message type.
  private handlerGetSceneGraph:  ((msg: GetSceneGraphMessage)  => void) | null = null;
  private handlerGetObject:      ((msg: GetObjectMessage)      => void) | null = null;
  private handlerSetTransform:   ((msg: SetTransformMessage)   => void) | null = null;
  private handlerSetMaterial:    ((msg: SetMaterialMessage)    => void) | null = null;
  private handlerSetVisible:     ((msg: SetVisibleMessage)     => void) | null = null;
  private handlerTakeScreenshot: ((msg: TakeScreenshotMessage) => void) | null = null;
  private handlerAddObject:      ((msg: AddObjectMessage)      => void) | null = null;
  private handlerRemoveObject:   ((msg: RemoveObjectMessage)   => void) | null = null;
  private handlerQueryBounds:    ((msg: QueryBoundsMessage)    => void) | null = null;
  private handlerQueryDistance:  ((msg: QueryDistanceMessage)  => void) | null = null;
  private handlerQueryFrustum:   ((msg: QueryFrustumMessage)   => void) | null = null;

  private statusListeners: StatusListener[] = [];

  constructor(options: SceneBridgeOptions = {}) {
    const port = options.port ?? 3333;
    const host = options.host ?? 'localhost';
    this.url        = `ws://${host}:${port}`;
    this.maxRetries = options.maxRetries ?? 5;
    this.baseDelay  = options.baseDelay  ?? 250;
  }

  // ─── Handler registration (fluent) ─────────────────────────────────────────

  onGetSceneGraph(handler: (msg: GetSceneGraphMessage) => void): this {
    this.handlerGetSceneGraph = handler;
    return this;
  }
  onGetObject(handler: (msg: GetObjectMessage) => void): this {
    this.handlerGetObject = handler;
    return this;
  }
  onSetTransform(handler: (msg: SetTransformMessage) => void): this {
    this.handlerSetTransform = handler;
    return this;
  }
  onSetMaterial(handler: (msg: SetMaterialMessage) => void): this {
    this.handlerSetMaterial = handler;
    return this;
  }
  onSetVisible(handler: (msg: SetVisibleMessage) => void): this {
    this.handlerSetVisible = handler;
    return this;
  }
  onTakeScreenshot(handler: (msg: TakeScreenshotMessage) => void): this {
    this.handlerTakeScreenshot = handler;
    return this;
  }
  onAddObject(handler: (msg: AddObjectMessage) => void): this {
    this.handlerAddObject = handler;
    return this;
  }
  onRemoveObject(handler: (msg: RemoveObjectMessage) => void): this {
    this.handlerRemoveObject = handler;
    return this;
  }
  onQueryBounds(handler: (msg: QueryBoundsMessage) => void): this {
    this.handlerQueryBounds = handler;
    return this;
  }
  onQueryDistance(handler: (msg: QueryDistanceMessage) => void): this {
    this.handlerQueryDistance = handler;
    return this;
  }
  onQueryFrustum(handler: (msg: QueryFrustumMessage) => void): this {
    this.handlerQueryFrustum = handler;
    return this;
  }

  onStatus(listener: StatusListener): this {
    this.statusListeners.push(listener);
    return this;
  }

  // ─── Lifecycle ──────────────────────────────────────────────────────────────

  connect(): void {
    this.stopped    = false;
    this.retryCount = 0;
    this.clearRetryTimer();
    this.attemptConnect();
  }

  disconnect(): void {
    this.stopped = true;
    this.clearRetryTimer();
    this.sendQueue = [];
    if (this.ws) {
      this.ws.onclose = null;
      this.ws.close(1000, 'Client disconnected');
      this.ws = null;
    }
    this.emitStatus('disconnected');
  }

  send(message: ClientToServerMessage): void {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(message));
    } else {
      this.sendQueue.push(message);
    }
  }

  // ─── Connection management ──────────────────────────────────────────────────

  private attemptConnect(): void {
    if (this.stopped) return;
    this.emitStatus('connecting');

    let ws: WebSocket;
    try {
      ws = new WebSocket(this.url);
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      this.emitStatus('error', error);
      this.emitStatus('disconnected');
      return;
    }

    this.ws = ws;

    ws.onopen = () => {
      if (this.ws !== ws) return;
      this.retryCount = 0;
      ws.send(HANDSHAKE);
      this.emitStatus('connected');
      this.drainQueue();
    };

    ws.onclose = (event) => {
      if (this.ws !== ws) return;
      this.ws = null;
      if (this.stopped) { this.emitStatus('disconnected'); return; }
      if (this.retryCount < this.maxRetries) {
        this.scheduleReconnect();
      } else {
        this.emitStatus('error', new Error(
          `WebSocket closed after ${this.maxRetries} retries (code ${event.code})`,
        ));
        this.emitStatus('disconnected');
      }
    };

    ws.onerror = () => {
      if (this.ws !== ws) return;
      this.emitStatus('error', new Error(`WebSocket error on ${this.url}`));
    };

    ws.onmessage = (event) => {
      if (this.ws !== ws) return;
      this.handleMessage(event);
    };
  }

  private scheduleReconnect(): void {
    const delay = this.baseDelay * Math.pow(2, this.retryCount);
    this.retryCount += 1;
    this.emitStatus('reconnecting');
    this.retryTimer = setTimeout(() => {
      this.retryTimer = null;
      this.attemptConnect();
    }, delay);
  }

  private drainQueue(): void {
    const queued = this.sendQueue.splice(0);
    for (const msg of queued) this.send(msg);
  }

  private clearRetryTimer(): void {
    if (this.retryTimer !== null) { clearTimeout(this.retryTimer); this.retryTimer = null; }
  }

  private emitStatus(status: ConnectionStatus, error?: Error): void {
    for (const listener of this.statusListeners) listener(status, error);
  }

  // ─── Message dispatch ───────────────────────────────────────────────────────

  private handleMessage(event: MessageEvent): void {
    let message: ServerToClientMessage;
    try {
      message = JSON.parse(event.data as string) as ServerToClientMessage;
    } catch {
      console.warn('[SceneBridge] Received non-JSON message:', event.data);
      return;
    }

    switch (message.type) {
      case 'get_scene_graph':  this.handlerGetSceneGraph?.(message);  break;
      case 'get_object':       this.handlerGetObject?.(message);       break;
      case 'set_transform':    this.handlerSetTransform?.(message);    break;
      case 'set_material':     this.handlerSetMaterial?.(message);     break;
      case 'set_visible':      this.handlerSetVisible?.(message);      break;
      case 'take_screenshot':  this.handlerTakeScreenshot?.(message);  break;
      case 'add_object':       this.handlerAddObject?.(message);       break;
      case 'remove_object':    this.handlerRemoveObject?.(message);    break;
      case 'query_bounds':     this.handlerQueryBounds?.(message);     break;
      case 'query_distance':   this.handlerQueryDistance?.(message);   break;
      case 'query_frustum':    this.handlerQueryFrustum?.(message);    break;
      default: {
        const _exhaustive: never = message;
        console.warn('[SceneBridge] Unhandled message type:', _exhaustive);
      }
    }
  }
}
