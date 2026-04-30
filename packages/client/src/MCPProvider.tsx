import { useEffect, useRef, useState } from 'react';
import { useThree } from '@react-three/fiber';
import type { Object3D, Mesh } from 'three';
import type { MCPProviderProps, SerializedNode } from './types';
import { SceneBridge } from './WebSocketServer';
import { MCPContext, updateMCPStore } from './useMCPStatus';
import type { MCPState } from './useMCPStatus';
import {
  serializeScene,
  serializeObject,
  findObject,
  applyTransform,
  applyMaterial,
} from './SceneSerializer';

// ─── Filtering helpers ────────────────────────────────────────────────────────

/**
 * Recursively prune a serialized tree according to include/exclude lists.
 *
 * - exclude: a node and its entire subtree are removed if its name or type
 *   appears in the list. Takes priority over include.
 * - include: a node is kept when its name or type matches, OR when at least
 *   one descendant survives (so ancestor nodes are preserved for context).
 *   An empty or absent include list means "keep everything".
 */
function filterTree(
  node: SerializedNode,
  include: string[] | undefined,
  exclude: string[] | undefined,
): SerializedNode | null {
  if (exclude?.includes(node.name) || exclude?.includes(node.type)) return null;

  const children = node.children
    .map(c => filterTree(c, include, exclude))
    .filter((c): c is SerializedNode => c !== null);

  const hasInclude = include && include.length > 0;
  const selfPasses =
    !hasInclude || include!.includes(node.name) || include!.includes(node.type);

  if (!selfPasses && children.length === 0) return null;

  return { ...node, children };
}

/**
 * Check whether a Three.js object is accessible given the current
 * include/exclude lists. Used before applying mutations.
 */
function isAllowed(
  obj: Object3D,
  include: string[] | undefined,
  exclude: string[] | undefined,
): boolean {
  if (exclude?.includes(obj.name) || exclude?.includes(obj.type)) return false;
  if (
    include &&
    include.length > 0 &&
    !include.includes(obj.name) &&
    !include.includes(obj.type)
  )
    return false;
  return true;
}

// ─── Component ────────────────────────────────────────────────────────────────

/**
 * Drop this inside any R3F <Canvas> to connect the scene to r3f-mcp-server.
 * Renders no geometry — only wires up the WebSocket bridge and passes children
 * through unchanged.
 *
 * @example
 * ```tsx
 * <Canvas gl={{ preserveDrawingBuffer: true }}>
 *   <MCPProvider port={3333}>
 *     <MyScene />
 *   </MCPProvider>
 * </Canvas>
 * ```
 */
export function MCPProvider({
  port = 3333,
  readOnly = false,
  onEdit,
  onStatus,
  include,
  exclude,
  screenshotQuality = 0.8,
  children,
}: MCPProviderProps) {
  const { scene, gl, camera, invalidate } = useThree();
  const bridgeRef = useRef<SceneBridge | null>(null);

  // Drives MCPContext re-renders when the connection status changes.
  const [mcpState, setMCPState] = useState<MCPState>({
    status: 'disconnected',
    connectedAt: null,
    lastError: null,
  });

  // ── Mutable refs for props that must not trigger bridge reconnection ────────
  // Updating these refs during render (before any hooks) is the idiomatic React
  // pattern for keeping closure values fresh without adding them as deps.
  const readOnlyRef          = useRef(readOnly);
  const onEditRef            = useRef(onEdit);
  const onStatusRef          = useRef(onStatus);
  const includeRef           = useRef(include);
  const excludeRef           = useRef(exclude);
  const screenshotQualityRef = useRef(screenshotQuality);

  readOnlyRef.current          = readOnly;
  onEditRef.current            = onEdit;
  onStatusRef.current          = onStatus;
  includeRef.current           = include;
  excludeRef.current           = exclude;
  screenshotQualityRef.current = screenshotQuality;

  // ── Bridge lifecycle — only reconnects when port / scene / gl / camera changes
  useEffect(() => {
    const bridge = new SceneBridge({ port });
    bridgeRef.current = bridge;

    // ── Shared guard: reject write ops in read-only mode ─────────────────────
    function guardReadOnly(requestId: string): boolean {
      if (!readOnlyRef.current) return false;
      bridge.send({
        type: 'error',
        requestId,
        payload: { message: 'MCPProvider is in read-only mode', code: 'READ_ONLY' },
      });
      return true;
    }

    // ── Shared lookup: find + filter-check, send error on failure ─────────────
    function resolve(id: string, requestId: string): Object3D | null {
      const obj = findObject(scene, id);
      if (!obj) {
        bridge.send({
          type: 'error',
          requestId,
          payload: { message: `Object not found: ${id}`, code: 'OBJECT_NOT_FOUND' },
        });
        return null;
      }
      if (!isAllowed(obj, includeRef.current, excludeRef.current)) {
        bridge.send({
          type: 'error',
          requestId,
          payload: { message: `Object "${id}" is not accessible`, code: 'FILTERED' },
        });
        return null;
      }
      return obj;
    }

    bridge
      // ── Connection status ─────────────────────────────────────────────────────
      // Updates three consumers in order:
      //   1. onStatus prop — for callers who prefer a callback over the hook
      //   2. MCPContext (React state) — for R3F children inside this Canvas
      //   3. external store — for DOM components outside the Canvas
      .onStatus((status, error) => {
        onStatusRef.current?.(status, error);

        const next: MCPState = {
          status,
          connectedAt: status === 'connected' ? new Date() : null,
          lastError:   error?.message ?? null,
        };
        setMCPState(next);
        updateMCPStore(next);
      })

      // ── Scene graph ──────────────────────────────────────────────────────────
      .onGetSceneGraph(msg => {
        const raw = serializeScene(scene);
        // filterTree returns null only if the scene root itself is excluded —
        // fall back to the unfiltered tree so the caller always gets something.
        const filtered =
          filterTree(raw, includeRef.current, excludeRef.current) ?? raw;

        bridge.send({
          type: 'scene_graph_response',
          requestId: msg.requestId,
          payload: { scene: filtered },
        });
      })

      // ── Single object ────────────────────────────────────────────────────────
      .onGetObject(msg => {
        const obj = findObject(scene, msg.payload.id);
        const visible =
          obj && isAllowed(obj, includeRef.current, excludeRef.current)
            ? serializeObject(obj)
            : null;

        bridge.send({
          type: 'object_response',
          requestId: msg.requestId,
          payload: { object: visible },
        });
      })

      // ── Transform ────────────────────────────────────────────────────────────
      .onSetTransform(msg => {
        if (guardReadOnly(msg.requestId)) return;

        const { id, ...transform } = msg.payload;
        const obj = resolve(id, msg.requestId);
        if (!obj) return;

        applyTransform(obj, transform);
        invalidate();

        onEditRef.current?.({ type: 'set_transform', target: obj.uuid, properties: transform });

        bridge.send({
          type: 'edit_confirmation',
          requestId: msg.requestId,
          payload: { id: obj.uuid, property: 'transform', success: true },
        });
      })

      // ── Material ─────────────────────────────────────────────────────────────
      .onSetMaterial(msg => {
        if (guardReadOnly(msg.requestId)) return;

        const { id, ...props } = msg.payload;
        const obj = resolve(id, msg.requestId);
        if (!obj) return;

        if (!('material' in obj)) {
          bridge.send({
            type: 'error',
            requestId: msg.requestId,
            payload: { message: `Object "${id}" has no material`, code: 'NOT_A_MESH' },
          });
          return;
        }

        applyMaterial(obj as Mesh, props);
        invalidate();

        onEditRef.current?.({ type: 'set_material', target: obj.uuid, properties: props });

        bridge.send({
          type: 'edit_confirmation',
          requestId: msg.requestId,
          payload: { id: obj.uuid, property: 'material', success: true },
        });
      })

      // ── Visibility ───────────────────────────────────────────────────────────
      .onSetVisible(msg => {
        if (guardReadOnly(msg.requestId)) return;

        const { id, visible } = msg.payload;
        const obj = resolve(id, msg.requestId);
        if (!obj) return;

        obj.visible = visible;
        invalidate();

        onEditRef.current?.({ type: 'set_visible', target: obj.uuid, properties: { visible } });

        bridge.send({
          type: 'edit_confirmation',
          requestId: msg.requestId,
          payload: { id: obj.uuid, property: 'visible', success: true },
        });
      })

      // ── Screenshot ───────────────────────────────────────────────────────────
      .onTakeScreenshot(msg => {
        const { width: reqW, height: reqH } = msg.payload;
        const canvas = gl.domElement;

        // Force a render so the buffer reflects the current scene state.
        // Users should also pass gl={{ preserveDrawingBuffer: true }} to <Canvas>
        // to avoid the WebGL buffer being auto-cleared between frames.
        gl.render(scene, camera);

        let dataUrl: string;

        if (reqW && reqH && (reqW !== canvas.width || reqH !== canvas.height)) {
          // Blit at the requested dimensions using an off-screen canvas.
          const offscreen  = document.createElement('canvas');
          offscreen.width  = reqW;
          offscreen.height = reqH;
          const ctx = offscreen.getContext('2d');
          if (ctx) {
            ctx.drawImage(canvas, 0, 0, reqW, reqH);
            dataUrl = offscreen.toDataURL('image/png');
          } else {
            // 2D context unavailable — fall back to native size
            dataUrl = canvas.toDataURL('image/png');
          }
        } else {
          dataUrl = canvas.toDataURL('image/png');
        }

        // Strip the data-URL prefix ("data:image/jpeg;base64,") → raw base64
        const base64 = dataUrl.split(',')[1] ?? '';

        bridge.send({
          type: 'screenshot_response',
          requestId: msg.requestId,
          payload: {
            image:  base64,
            width:  reqW ?? canvas.width,
            height: reqH ?? canvas.height,
          },
        });
      })

      .connect();

    return () => {
      bridge.disconnect();
      bridgeRef.current = null;
    };
  }, [port, scene, gl, camera, invalidate]);

  // Wrap children in MCPContext so R3F components inside this Canvas can call
  // useMCPStatus() and read the context directly (without the external store).
  return (
    <MCPContext.Provider value={mcpState}>
      {children}
    </MCPContext.Provider>
  );
}

export default MCPProvider;
