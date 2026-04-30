import { useEffect, useRef, useState } from 'react';
import { useThree } from '@react-three/fiber';
import { Box3, Vector3, Frustum, Matrix4 } from 'three';
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
  createObject,
  destroyObject,
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

        // Strip the data-URL prefix ("data:image/png;base64,") → raw base64
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

      // ── Add object ───────────────────────────────────────────────────────────
      .onAddObject(msg => {
        if (guardReadOnly(msg.requestId)) return;

        const parent = msg.payload.parent
          ? (findObject(scene, msg.payload.parent) ?? scene)
          : scene;

        let created: Object3D;
        try {
          created = createObject(msg.payload, parent);
        } catch (err) {
          bridge.send({
            type: 'error',
            requestId: msg.requestId,
            payload: { message: err instanceof Error ? err.message : String(err), code: 'CREATE_FAILED' },
          });
          return;
        }

        invalidate();
        onEditRef.current?.({ type: 'add_object', target: created.uuid, properties: msg.payload as unknown as Record<string, unknown> });

        bridge.send({
          type: 'add_object_response',
          requestId: msg.requestId,
          payload: { uuid: created.uuid, name: created.name },
        });
      })

      // ── Remove object ────────────────────────────────────────────────────────
      .onRemoveObject(msg => {
        if (guardReadOnly(msg.requestId)) return;

        const obj = resolve(msg.payload.id, msg.requestId);
        if (!obj) return;

        const { uuid, name } = obj;
        const removed = destroyObject(obj);
        if (!removed) {
          bridge.send({
            type: 'error',
            requestId: msg.requestId,
            payload: { message: `Cannot remove protected object "${name}"`, code: 'PROTECTED' },
          });
          return;
        }

        invalidate();
        onEditRef.current?.({ type: 'remove_object', target: uuid, properties: { name } });

        bridge.send({
          type: 'remove_object_response',
          requestId: msg.requestId,
          payload: { uuid, name },
        });
      })

      // ── Query bounds ─────────────────────────────────────────────────────────
      .onQueryBounds(msg => {
        const obj = resolve(msg.payload.id, msg.requestId);
        if (!obj) return;

        const box = new Box3().setFromObject(obj);
        if (box.isEmpty()) {
          bridge.send({
            type: 'error',
            requestId: msg.requestId,
            payload: { message: `"${obj.name}" has no geometry for bounds computation`, code: 'EMPTY_BOUNDS' },
          });
          return;
        }

        const center = new Vector3();
        const size   = new Vector3();
        box.getCenter(center);
        box.getSize(size);

        bridge.send({
          type: 'query_bounds_response',
          requestId: msg.requestId,
          payload: {
            min:    box.min.toArray() as [number, number, number],
            max:    box.max.toArray() as [number, number, number],
            center: center.toArray() as [number, number, number],
            size:   size.toArray()   as [number, number, number],
          },
        });
      })

      // ── Query distance ───────────────────────────────────────────────────────
      .onQueryDistance(msg => {
        const fromObj = findObject(scene, msg.payload.fromId);
        const toObj   = findObject(scene, msg.payload.toId);

        if (!fromObj) {
          bridge.send({ type: 'error', requestId: msg.requestId,
            payload: { message: `Object not found: "${msg.payload.fromId}"`, code: 'OBJECT_NOT_FOUND' } });
          return;
        }
        if (!toObj) {
          bridge.send({ type: 'error', requestId: msg.requestId,
            payload: { message: `Object not found: "${msg.payload.toId}"`, code: 'OBJECT_NOT_FOUND' } });
          return;
        }

        const fromPos = new Vector3();
        const toPos   = new Vector3();
        fromObj.getWorldPosition(fromPos);
        toObj.getWorldPosition(toPos);

        const diff     = toPos.clone().sub(fromPos);
        const distance = diff.length();
        const vector   = distance > 0
          ? diff.clone().divideScalar(distance).toArray() as [number, number, number]
          : [0, 0, 0] as [number, number, number];

        bridge.send({
          type: 'query_distance_response',
          requestId: msg.requestId,
          payload: {
            distance,
            fromPosition: fromPos.toArray() as [number, number, number],
            toPosition:   toPos.toArray()   as [number, number, number],
            vector,
          },
        });
      })

      // ── Query frustum ────────────────────────────────────────────────────────
      .onQueryFrustum(msg => {
        // Determine which camera to use.
        let cam = camera;
        if (msg.payload.cameraId) {
          const found = findObject(scene, msg.payload.cameraId);
          if (!found) {
            bridge.send({ type: 'error', requestId: msg.requestId,
              payload: { message: `Camera not found: "${msg.payload.cameraId}"`, code: 'OBJECT_NOT_FOUND' } });
            return;
          }
          const isCamera = (found as unknown as Record<string, unknown>)['isCamera'] === true;
          if (!isCamera) {
            bridge.send({ type: 'error', requestId: msg.requestId,
              payload: { message: `"${msg.payload.cameraId}" is not a camera`, code: 'NOT_A_CAMERA' } });
            return;
          }
          cam = found as typeof camera;
        }

        // Build world-space frustum from the camera's projection matrix.
        cam.updateWorldMatrix(true, false);
        const projScreen = new Matrix4().multiplyMatrices(
          cam.projectionMatrix,
          cam.matrixWorldInverse,
        );
        const frustum = new Frustum().setFromProjectionMatrix(projScreen);

        const visibleObjects: Array<{ name: string; uuid: string; type: string; worldPosition: [number, number, number] }> = [];
        let totalObjects = 0;

        scene.traverse(obj => {
          if (obj === scene) return; // skip Scene root
          totalObjects++;
          if (!obj.visible) return;
          try {
            if (!frustum.intersectsObject(obj)) return;
          } catch { return; }

          const wp = new Vector3();
          obj.getWorldPosition(wp);
          visibleObjects.push({
            name:          obj.name || `${obj.type}_${obj.uuid}`,
            uuid:          obj.uuid,
            type:          obj.type,
            worldPosition: wp.toArray() as [number, number, number],
          });
        });

        bridge.send({
          type: 'query_frustum_response',
          requestId: msg.requestId,
          payload: {
            visibleObjects,
            totalObjects,
            visibleCount: visibleObjects.length,
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
