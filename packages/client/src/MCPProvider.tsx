import { useEffect, useRef, useState } from 'react';
import type { ComponentType } from 'react';
import { useThree, useFrame } from '@react-three/fiber';
import { Box3, Vector3, Frustum, Matrix4 } from 'three';
import type { Object3D, Scene, Mesh, AnimationMixer } from 'three';
import { InjectionErrorBoundary } from './InjectionErrorBoundary';
import { evaluateComponent, buildInjectionScope } from './injectionEvaluator';
import type {
  MCPProviderProps, SerializedNode,
  AnimationInfo, SceneStats,
  PhysicsBody, PhysicsCollider,
} from './types';
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
import { getAllMixerEntries } from './animationRegistry';
import { getPhysicsWorld } from './physicsRegistry';

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

// ─── v0.3 Animation helpers ───────────────────────────────────────────────────

/** Extract all AnimationActions from a mixer into the shared result array. */
function extractMixerActions(
  mixer: AnimationMixer,
  label: string,
  out: AnimationInfo[],
): void {
  // _actions is a private array on THREE.AnimationMixer
  const actions = (mixer as unknown as { _actions?: unknown[] })._actions;
  if (!Array.isArray(actions)) return;

  for (const a of actions) {
    const action = a as Record<string, unknown>;
    const clip   = action['_clip'] as Record<string, unknown> | undefined;
    if (!clip) continue;

    const duration = (clip['duration'] as number) || 0;
    const elapsed  = (action['time']   as number) || 0;
    const tracks   = clip['tracks'] as Array<{ name: string }> | undefined;
    const loop     = (action['loop'] as number) !== 2200; // THREE.LoopOnce = 2200

    out.push({
      name:     (clip['name'] as string) || 'unnamed',
      target:   label,
      property: tracks?.[0]?.name ?? 'unknown',
      duration,
      elapsed,
      progress: duration > 0 ? Math.min(elapsed / duration, 1) : 0,
      loop,
      paused: Boolean(action['paused']),
      type:   'mixer',
    });
  }
}

function collectAnimations(scene: Scene, identifier?: string): AnimationInfo[] {
  const result: AnimationInfo[] = [];

  // Priority 1: explicitly registered via useRegisterAnimation
  for (const [uuid, { mixer, label }] of getAllMixerEntries()) {
    if (identifier && uuid !== identifier && label !== identifier) continue;
    extractMixerActions(mixer, label, result);
  }

  // Priority 2: scan scene objects for the userData.mixer convention
  scene.traverse(obj => {
    if (identifier && obj.uuid !== identifier && obj.name !== identifier) return;
    if (getAllMixerEntries().has(obj.uuid)) return; // already counted above
    const candidate = (obj.userData as Record<string, unknown>)['mixer'];
    if (!candidate || typeof (candidate as Record<string, unknown>)['update'] !== 'function') return;
    extractMixerActions(candidate as AnimationMixer, obj.name || obj.uuid, result);
  });

  return result;
}

// ─── v0.3 Physics helpers ─────────────────────────────────────────────────────

function extractPhysicsState(world: unknown, identifier?: string) {
  const w = world as Record<string, unknown>;
  const bodies: PhysicsBody[] = [];

  const rawBodies = (
    w['bodies'] ??
    (w['raw'] as Record<string, unknown> | undefined)?.['bodies']
  ) as { forEach: (fn: (b: unknown) => void) => void } | undefined;

  rawBodies?.forEach((rawBody: unknown) => {
    const body = rawBody as Record<string, unknown>;
    const ud   = (body['userData'] ?? {}) as Record<string, unknown>;
    const name = (ud['name']  as string | undefined) ?? `body_${String(body['handle'] ?? '?')}`;
    const uuid = (ud['uuid']  as string | undefined) ?? String(body['handle'] ?? '');

    if (identifier && uuid !== identifier && name !== identifier) return;

    type Vec3 = { x: number; y: number; z: number };
    type Vec4 = Vec3 & { w: number };
    const t  = (body['translation'] as (() => Vec3) | undefined)?.();
    const r  = (body['rotation']    as (() => Vec4) | undefined)?.();
    const lv = (body['linvel']      as (() => Vec3) | undefined)?.();
    const av = (body['angvel']      as (() => Vec3) | undefined)?.();

    const bodyTypeNum = (body['bodyType'] as (() => number) | undefined)?.() ?? 0;
    const typeMap = ['dynamic', 'fixed', 'kinematicPosition', 'kinematicVelocity'] as const;

    const colliders: PhysicsCollider[] = [];
    const nc = (body['numColliders'] as (() => number) | undefined)?.() ?? 0;
    for (let i = 0; i < nc; i++) {
      const col = (body['collider'] as ((i: number) => Record<string, unknown>) | undefined)?.(i);
      if (!col) continue;
      const shape = (col['shape'] as Record<string, unknown> | undefined) ?? {};
      const he = shape['halfExtents'] as Vec3 | undefined;
      colliders.push({
        shape:       String(shape['type'] ?? 'unknown'),
        isSensor:    Boolean((col['isSensor']    as (() => boolean) | undefined)?.()),
        friction:    (col['friction']    as (() => number) | undefined)?.() ?? 0,
        restitution: (col['restitution'] as (() => number) | undefined)?.() ?? 0,
        ...(he != null && { halfExtents: [he.x, he.y, he.z] as [number, number, number] }),
        ...((shape['radius'] as number | undefined) != null && { radius: shape['radius'] as number }),
      });
    }

    bodies.push({
      name, uuid,
      bodyType:        typeMap[bodyTypeNum] ?? 'dynamic',
      position:        t  ? [t.x,  t.y,  t.z]        : [0, 0, 0],
      rotation:        r  ? [r.x,  r.y,  r.z, r.w]   : [0, 0, 0, 1],
      linearVelocity:  lv ? [lv.x, lv.y, lv.z]       : [0, 0, 0],
      angularVelocity: av ? [av.x, av.y, av.z]        : [0, 0, 0],
      mass:       (body['mass']       as (() => number)  | undefined)?.() ?? 0,
      isSleeping: (body['isSleeping'] as (() => boolean) | undefined)?.() ?? false,
      isEnabled:  (body['isEnabled']  as (() => boolean) | undefined)?.() ?? true,
      colliders,
    });
  });

  const g = w['gravity'] as { x: number; y: number; z: number } | undefined;
  return {
    available:    true as const,
    bodies,
    joints:       [] as [],
    gravity:      (g ? [g.x, g.y, g.z] : [0, -9.81, 0]) as [number, number, number],
    totalBodies:  bodies.length,
    activeBodies: bodies.filter(b => !b.isSleeping).length,
  };
}

// ─── v0.3 Performance helpers ─────────────────────────────────────────────────

function getSceneStats(scene: Scene): SceneStats {
  let totalObjects = 0, visibleObjects = 0, meshCount = 0, lightCount = 0, groupCount = 0;
  scene.traverse(obj => {
    totalObjects++;
    if (obj.visible) visibleObjects++;
    const r = obj as unknown as Record<string, unknown>;
    if      (r['isMesh']  === true) meshCount++;
    else if (r['isLight'] === true) lightCount++;
    else if (obj.type === 'Group')  groupCount++;
  });
  return { totalObjects, visibleObjects, meshCount, lightCount, groupCount };
}

interface ProfilingSession {
  requestId: string;
  startTime: number;
  durationMs: number;
  done: boolean;
  deltas: number[];   // frame times in seconds
  snapshots: Array<{ drawCalls: number; triangles: number; points: number; lines: number }>;
}

function buildProfileResult(session: ProfilingSession, scene: Scene) {
  const { deltas, snapshots, durationMs } = session;

  if (deltas.length === 0) {
    const z = { min: 0, max: 0, average: 0 };
    return { duration: durationMs / 1000, frames: 0, fps: { min: 0, max: 0, average: 0, median: 0, p99: 0 }, drawCalls: z, triangles: z, heaviestObjects: [], recommendations: [] };
  }

  const avg = (a: number[]) => a.reduce((s, v) => s + v, 0) / a.length;
  // Sort ascending so index 0 = worst (slowest) FPS, last = best
  const fpsSorted = deltas.map(d => 1 / d).sort((a, b) => a - b);
  const dcList    = snapshots.map(s => s.drawCalls);
  const triList   = snapshots.map(s => s.triangles);
  const r1 = (n: number) => Math.round(n * 10) / 10;

  // Heaviest meshes
  const heavy: Array<{ name: string; uuid: string; triangles: number; drawCalls: number }> = [];
  scene.traverse(obj => {
    const pos = ((obj as unknown as Record<string, unknown>)['geometry'] as Record<string, unknown> | undefined)
      ?.['attributes'] && ((obj as unknown as Record<string, unknown>)['geometry'] as Record<string, unknown>)
      ['attributes'] && (((obj as unknown as Record<string, unknown>)['geometry'] as Record<string, unknown>)
      ['attributes'] as Record<string, unknown>)['position'];
    const cnt = pos ? (pos as Record<string, unknown>)['count'] as number | undefined : undefined;
    if (cnt) heavy.push({ name: obj.name || obj.uuid, uuid: obj.uuid, triangles: Math.floor(cnt / 3), drawCalls: 1 });
  });
  heavy.sort((a, b) => b.triangles - a.triangles);

  // Geometry-sharing check for instancing hint
  const geoIds: string[] = [];
  scene.traverse(obj => {
    const id = ((obj as unknown as Record<string, unknown>)['geometry'] as Record<string, unknown> | undefined)?.['uuid'] as string | undefined;
    if (id) geoIds.push(id);
  });
  const sharedCount = geoIds.length - new Set(geoIds).size;

  const recommendations: string[] = [];
  if (avg(dcList) > 100)   recommendations.push(`High draw calls (~${Math.round(avg(dcList))}/frame) — consider geometry merging or InstancedMesh`);
  const bigMeshes = heavy.filter(m => m.triangles > 100_000);
  if (bigMeshes.length)    recommendations.push(`${bigMeshes.length} mesh(es) with >100K triangles — consider LOD`);
  if (sharedCount > 5)     recommendations.push(`${sharedCount} meshes share geometry — consider InstancedMesh`);

  return {
    duration: durationMs / 1000,
    frames:   deltas.length,
    fps: {
      min:     r1(fpsSorted[0]),
      max:     r1(fpsSorted[fpsSorted.length - 1]),
      average: r1(avg(fpsSorted)),
      median:  r1(fpsSorted[Math.floor(fpsSorted.length / 2)]),
      p99:     r1(fpsSorted[Math.max(0, Math.floor(fpsSorted.length * 0.01))]),
    },
    drawCalls: { min: Math.min(...dcList),  max: Math.max(...dcList),  average: Math.round(avg(dcList)) },
    triangles: { min: Math.min(...triList), max: Math.max(...triList), average: Math.round(avg(triList)) },
    heaviestObjects: heavy.slice(0, 10),
    recommendations,
  };
}

// ─── v0.4 injection types ─────────────────────────────────────────────────────

interface InjectedEntry {
  name: string;
  uuid: string;
  code: string;
  Component: ComponentType | null;
  evalError: string | null;
  injectedAt: Date;
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

  // ── v0.3: Performance tracking refs ─────────────────────────────────────────
  // Updated every frame via useFrame; polled on demand by get_performance.
  const deltasRef     = useRef<number[]>([]);
  const renderInfoRef = useRef({ drawCalls: 0, triangles: 0, points: 0, lines: 0, geometries: 0, textures: 0, programs: 0 });
  const profilingRef  = useRef<ProfilingSession | null>(null);

  // ── v0.4: Live injection state ──────────────────────────────────────────────
  const [injections, setInjections] = useState<InjectedEntry[]>([]);
  // Ref keeps handlers in useEffect closures current without reconnecting the bridge.
  const injectionsRef = useRef<InjectedEntry[]>([]);
  injectionsRef.current = injections;

  useFrame((_, delta) => {
    // Maintain a 60-frame ring buffer of delta times (seconds)
    deltasRef.current.push(delta);
    if (deltasRef.current.length > 60) deltasRef.current.shift();

    // Snapshot render counters before Three.js auto-resets them after the frame
    renderInfoRef.current = {
      drawCalls:  gl.info.render.calls,
      triangles:  gl.info.render.triangles,
      points:     gl.info.render.points,
      lines:      gl.info.render.lines,
      geometries: gl.info.memory.geometries,
      textures:   gl.info.memory.textures,
      programs:   gl.info.programs?.length ?? 0,
    };

    // Feed the active profiling session (if any)
    const session = profilingRef.current;
    if (session && !session.done) {
      session.deltas.push(delta);
      session.snapshots.push({ ...renderInfoRef.current });
      if (Date.now() - session.startTime >= session.durationMs) {
        session.done = true;
        bridgeRef.current?.send({
          type:      'profile_response',
          requestId: session.requestId,
          payload:   buildProfileResult(session, scene),
        });
      }
    }
  });

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

      // ── v0.3: Animations ─────────────────────────────────────────────────────
      .onGetAnimations(msg => {
        const animations = collectAnimations(scene, msg.payload.identifier);
        bridge.send({
          type:      'animations_response',
          requestId: msg.requestId,
          payload:   { animations, totalAnimations: animations.length },
        });
      })

      .onControlAnimation(msg => {
        if (guardReadOnly(msg.requestId)) return;
        const { target, action, time, animationName } = msg.payload;

        // Find mixer: check registry first, then userData fallback
        let mixer: AnimationMixer | null = null;
        let label = target;
        for (const [uuid, entry] of getAllMixerEntries()) {
          if (uuid === target || entry.label === target) {
            mixer = entry.mixer; label = entry.label; break;
          }
        }
        if (!mixer) {
          const obj = findObject(scene, target);
          if (obj) {
            const c = (obj.userData as Record<string, unknown>)['mixer'];
            if (c && typeof (c as Record<string, unknown>)['update'] === 'function') {
              mixer = c as AnimationMixer; label = obj.name || obj.uuid;
            }
          }
        }
        if (!mixer) {
          bridge.send({ type: 'error', requestId: msg.requestId,
            payload: { message: `No AnimationMixer found for "${target}"`, code: 'NO_MIXER' } });
          return;
        }

        const allActions = (mixer as unknown as { _actions?: unknown[] })._actions ?? [];
        const targetAction = (animationName
          ? allActions.find((a: unknown) =>
              ((a as Record<string, unknown>)['_clip'] as Record<string, unknown> | undefined)?.['name'] === animationName)
          : allActions[0]) as Record<string, unknown> | undefined;

        if (!targetAction) {
          bridge.send({ type: 'error', requestId: msg.requestId,
            payload: { message: `No animation found${animationName ? ` named "${animationName}"` : ''}`, code: 'NO_ACTION' } });
          return;
        }

        type AnyAction = Record<string, unknown> & { play: () => void; stop: () => void; isRunning: () => boolean };
        const act = targetAction as AnyAction;
        switch (action) {
          case 'play':  act.play(); act['paused'] = false; break;
          case 'pause': act['paused'] = true; break;
          case 'stop':  act.stop(); break;
          case 'seek':
            act['time']   = time ?? 0;
            act['paused'] = true;
            mixer.update(0);
            break;
        }
        invalidate();
        void label; // used for the registry lookup above

        const clip    = act['_clip'] as Record<string, unknown> | undefined;
        const running = act.isRunning?.();
        const paused  = Boolean(act['paused']);
        bridge.send({
          type: 'animation_control_response', requestId: msg.requestId,
          payload: {
            success:     true,
            animation:   (clip?.['name'] as string) || 'unnamed',
            state:       paused ? 'paused' : running ? 'playing' : 'stopped',
            currentTime: (act['time'] as number) ?? 0,
          },
        });
      })

      // ── v0.3: Physics ─────────────────────────────────────────────────────────
      .onGetPhysics(msg => {
        const world = getPhysicsWorld();
        if (!world) {
          bridge.send({
            type: 'physics_response', requestId: msg.requestId,
            payload: {
              available: false,
              message: 'No physics world registered. Call useRegisterPhysics(world) from useRapier() inside your <Physics> provider.',
            },
          });
          return;
        }
        try {
          bridge.send({
            type: 'physics_response', requestId: msg.requestId,
            payload: extractPhysicsState(world, msg.payload.identifier),
          });
        } catch (err) {
          bridge.send({ type: 'error', requestId: msg.requestId,
            payload: { message: `Physics read error: ${err instanceof Error ? err.message : String(err)}`, code: 'PHYSICS_ERROR' } });
        }
      })

      // ── v0.3: Performance snapshot ────────────────────────────────────────────
      .onGetPerformance(msg => {
        const deltas   = deltasRef.current;
        const avgDelta = deltas.length > 0 ? deltas.reduce((a, b) => a + b, 0) / deltas.length : 0.016;
        const info     = renderInfoRef.current;
        bridge.send({
          type: 'performance_response', requestId: msg.requestId,
          payload: {
            fps:        Math.round((1 / avgDelta) * 10) / 10,
            frameTime:  Math.round(avgDelta * 1000 * 100) / 100,
            drawCalls:  info.drawCalls,
            triangles:  info.triangles,
            points:     info.points,
            lines:      info.lines,
            geometries: info.geometries,
            textures:   info.textures,
            programs:   info.programs,
            memory:     { geometries: info.geometries, textures: info.textures },
            scene:      getSceneStats(scene),
          },
        });
      })

      // ── v0.3: Profiling ───────────────────────────────────────────────────────
      .onStartProfile(msg => {
        const dur = Math.min(Math.max(msg.payload.duration, 0.5), 30);
        profilingRef.current = {
          requestId:  msg.requestId,
          startTime:  Date.now(),
          durationMs: dur * 1000,
          done:       false,
          deltas:     [],
          snapshots:  [],
        };
        // No immediate response — useFrame accumulates data and sends when done.
      })

      // ── v0.4: Live injection ──────────────────────────────────────────────────
      .onInjectCode(msg => {
        const { code, name, replace } = msg.payload;
        const uuid = crypto.randomUUID();
        const scope = buildInjectionScope();
        const { Component, error } = evaluateComponent(code, scope);

        setInjections(prev => {
          // Remove the target name (either the explicit replace target or same name)
          const nameToRemove = replace ?? name;
          const filtered = prev.filter(i => i.name !== nameToRemove);
          return [
            ...filtered,
            { name, uuid, code, Component, evalError: error, injectedAt: new Date() },
          ];
        });

        bridge.send({
          type:      'inject_code_response',
          requestId: msg.requestId,
          payload:   { success: Component !== null, uuid, name, error: error ?? undefined },
        });
      })

      .onRemoveInjection(msg => {
        const { name } = msg.payload;
        setInjections(prev => prev.filter(i => i.name !== name));
        bridge.send({
          type:      'injection_removed_response',
          requestId: msg.requestId,
          payload:   { success: true, name },
        });
      })

      .onGetInjections(msg => {
        bridge.send({
          type:      'injections_list_response',
          requestId: msg.requestId,
          payload: {
            injections: injectionsRef.current.map(i => ({
              name:        i.name,
              uuid:        i.uuid,
              code:        i.code,
              injectedAt:  i.injectedAt.toISOString(),
              hasErrors:   i.evalError !== null,
            })),
          },
        });
      })

      .connect();

    return () => {
      bridge.disconnect();
      bridgeRef.current = null;
    };
  }, [port, scene, gl, camera, invalidate]);

  // Render injected preview components alongside the user's scene children.
  // Each injection gets its own ErrorBoundary so a bad component can't crash
  // the whole scene — it shows a red wireframe placeholder instead, and the
  // error is reported back to Claude for self-correction.
  return (
    <MCPContext.Provider value={mcpState}>
      {children}
      <group name="__r3f-mcp-injections__">
        {injections.map(entry => {
          const Comp = entry.Component;
          if (!Comp) return null;
          return (
            <InjectionErrorBoundary
              key={entry.uuid}
              onError={(err) => {
                setInjections(prev =>
                  prev.map(i =>
                    i.uuid === entry.uuid ? { ...i, evalError: err.message } : i,
                  ),
                );
                // Report the render error back so Claude can fix and re-inject.
                bridgeRef.current?.send({
                  type:      'inject_code_response',
                  requestId: `render-error-${entry.uuid}`,
                  payload:   { success: false, uuid: entry.uuid, name: entry.name, error: err.message },
                });
              }}
            >
              <Comp />
            </InjectionErrorBoundary>
          );
        })}
      </group>
    </MCPContext.Provider>
  );
}

export default MCPProvider;
