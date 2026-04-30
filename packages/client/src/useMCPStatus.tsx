import { createContext, useContext, useSyncExternalStore } from 'react';
import type { ConnectionStatus } from './types';

// ─── State type ───────────────────────────────────────────────────────────────

export interface MCPState {
  status: ConnectionStatus;
  /** Set when the connection becomes 'connected'. Null at all other times. */
  connectedAt: Date | null;
  /** Error message from the most recent 'error' status event. Null otherwise. */
  lastError: string | null;
}

const DEFAULT_STATE: MCPState = {
  status: 'disconnected',
  connectedAt: null,
  lastError: null,
};

// ─── React context ────────────────────────────────────────────────────────────
//
// MCPProvider provides this context to its children inside the Canvas.
// The null sentinel lets useMCPStatus detect "no provider in this React tree"
// and fall back to the external store (needed for DOM components outside Canvas).

export const MCPContext = createContext<MCPState | null>(null);

// ─── Module-level store ───────────────────────────────────────────────────────
//
// R3F renders its subtree with a separate React reconciler, so context from
// inside the Canvas does not propagate to DOM components outside it.
// This store bridges the two trees: MCPProvider writes here and any component
// (inside or outside Canvas) can subscribe via useSyncExternalStore.

type Listener = () => void;
let _state: MCPState = DEFAULT_STATE;
const _listeners = new Set<Listener>();

/** Called by MCPProvider whenever the bridge emits a status event. */
export function updateMCPStore(next: MCPState): void {
  _state = next;
  _listeners.forEach(l => l());
}

function subscribe(listener: Listener): () => void {
  _listeners.add(listener);
  return () => { _listeners.delete(listener); };
}

const getSnapshot       = (): MCPState => _state;
const getServerSnapshot = (): MCPState => DEFAULT_STATE;

// ─── Inject animation keyframes once at module load ───────────────────────────
//
// Avoids emitting a <style> tag on every render. The guard makes it safe to
// call multiple times and to run in SSR (where document is undefined).

if (typeof document !== 'undefined') {
  const STYLE_ID = '__r3f-mcp-styles__';
  if (!document.getElementById(STYLE_ID)) {
    const el = document.createElement('style');
    el.id = STYLE_ID;
    el.textContent = `
      @keyframes _mcp-pulse {
        0%, 100% { opacity: 1;   transform: scale(1); }
        50%       { opacity: 0.4; transform: scale(0.85); }
      }
    `;
    document.head.appendChild(el);
  }
}

// ─── useMCPStatus hook ────────────────────────────────────────────────────────

/**
 * Returns the current MCP connection state — status, connectedAt, lastError.
 *
 * Works from **any** component:
 * - Inside an R3F `<Canvas>`: reads the React context provided by `<MCPProvider>`.
 * - Outside `<Canvas>` (DOM overlays, headers, etc.): reads the module-level
 *   store that MCPProvider also writes to, bridging the two renderer trees.
 *
 * @example
 * // Inside Canvas — object reacts to connection state
 * function Indicator3D() {
 *   const { status } = useMCPStatus();
 *   return <mesh visible={status === 'connected'}>…</mesh>;
 * }
 *
 * // Outside Canvas — DOM component
 * function StatusBar() {
 *   const { status, connectedAt } = useMCPStatus();
 *   return <p>MCP {status} {connectedAt && `since ${connectedAt.toLocaleTimeString()}`}</p>;
 * }
 */
export function useMCPStatus(): MCPState {
  // Reads the React context when inside the Canvas (context is preferred because
  // it integrates with React's rendering model and batching).
  const ctxValue = useContext(MCPContext);
  // Always subscribe to the external store — needed when outside the Canvas.
  const storeValue = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  // Context wins when available (non-null = inside an MCPProvider tree).
  return ctxValue ?? storeValue;
}

// ─── MCPStatusIndicator ───────────────────────────────────────────────────────

const DOT_COLOR: Record<ConnectionStatus, string> = {
  connected:    '#22c55e', // green
  connecting:   '#f59e0b', // amber
  reconnecting: '#f59e0b', // amber (same visual as connecting)
  disconnected: '#6b7280', // gray
  error:        '#ef4444', // red
};

export interface MCPStatusIndicatorProps {
  /** Diameter of the dot in pixels. Default: 10 */
  size?: number;
  /**
   * Render the status label text next to the dot.
   * Default: false (dot + native tooltip only)
   */
  showLabel?: boolean;
}

/**
 * A self-contained MCP connection indicator — a small colored dot with a
 * native browser tooltip. No external CSS or dependencies required.
 *
 * Reads from `useMCPStatus()` so it works anywhere: inside R3F `<Canvas>`
 * (via React context) or in regular DOM components (via the external store).
 *
 * Color semantics:
 * - 🟢 Green  — connected
 * - 🟡 Amber  — connecting / reconnecting
 * - 🔴 Red    — error
 * - ⚫ Gray   — disconnected
 */
export function MCPStatusIndicator({
  size = 10,
  showLabel = false,
}: MCPStatusIndicatorProps) {
  const { status, connectedAt, lastError } = useMCPStatus();

  const color         = DOT_COLOR[status];
  const isTransient   = status === 'connecting' || status === 'reconnecting';
  const isConnected   = status === 'connected';

  // Build a descriptive tooltip string.
  const parts: string[] = [`r3f-mcp: ${status}`];
  if (isConnected && connectedAt) {
    parts.push(`since ${connectedAt.toLocaleTimeString()}`);
  }
  if (lastError && status === 'error') {
    parts.push(lastError);
  }
  const tooltip = parts.join(' · ');

  return (
    <span
      title={tooltip}
      aria-label={tooltip}
      role="status"
      style={{
        display:       'inline-flex',
        alignItems:    'center',
        gap:           showLabel ? Math.round(size * 0.7) : 0,
        cursor:        'default',
        userSelect:    'none',
        verticalAlign: 'middle',
        lineHeight:    1,
      }}
    >
      <span
        style={{
          display:      'inline-block',
          width:        size,
          height:       size,
          borderRadius: '50%',
          flexShrink:   0,
          background:   color,
          boxShadow:    isConnected ? `0 0 ${Math.round(size)}px ${color}99` : 'none',
          transition:   'background 0.25s ease, box-shadow 0.25s ease',
          animation:    isTransient ? '_mcp-pulse 1.1s ease-in-out infinite' : 'none',
        }}
      />

      {showLabel && (
        <span
          style={{
            fontFamily: '"SF Mono","Fira Code","Cascadia Code",ui-monospace,monospace',
            fontSize:   Math.round(size * 1.1),
            lineHeight: 1,
            color,
            transition: 'color 0.25s ease',
            whiteSpace: 'nowrap',
          }}
        >
          {status}
        </span>
      )}
    </span>
  );
}
