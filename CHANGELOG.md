# Changelog

All notable changes to this project will be documented here.

## [0.4.0] — 2026-05-01

### Live component injection — the creative engine

#### Core innovation: `inject_code`

`inject_code` is the breakthrough feature of this release. Claude writes a complete R3F component as a string of TSX code; the MCP server sends it to the browser over WebSocket; the browser evaluates it with [sucrase](https://github.com/alangpierce/sucrase) and `new Function`, mounts it into the running R3F scene, and the user sees the result instantly — no file write, no dev server restart, no manual copy-paste.

Every injected component runs inside an `InjectionErrorBoundary`. If the component throws during render, a red wireframe box appears in its place and the error is reported back to Claude for self-correction — the user never sees a crash.

#### New tools

| Tool | Description |
|---|---|
| `generate_component` | Fetches scene context (positions, materials, lighting) and returns a structured prompt that guides Claude to generate a self-contained R3F component and inject it. Scene-aware — generated code fits the existing scene naturally. |
| `inject_code` | Evaluate and mount arbitrary TSX/JSX in the browser immediately. Errors are returned to Claude for self-correction. Scope: React hooks, `useFrame`/`useThree`, full `THREE` namespace. |
| `commit_component` | Write a live-preview injection to an actual `.tsx` file. Returns the import line and JSX usage snippet. |
| `scaffold_project` | Generate a complete new R3F project to disk: `package.json`, Vite config, `tsconfig.json`, entry point, and `App.tsx` pre-wired with `MCPProvider` for immediate AI iteration. |
| `list_injections` | List all currently active live-preview components with name, UUID, code, timestamp, and error state. |
| `remove_injection` | Unmount and remove a live-preview component by name. |

#### `r3f-mcp` (client)

- **`InjectionErrorBoundary`** — React class-component error boundary that catches render errors in injected components. Falls back to a red wireframe box and reports the error to Claude.
- **`injectionEvaluator.ts`** — `evaluateComponent(code, scope)` transforms JSX/TS with sucrase, strips import statements, and evaluates with `new Function`. `buildInjectionScope()` provides the standard scope (React hooks, useFrame/useThree, THREE).
- `MCPProvider` now maintains `injections` state and renders a `<group name="__r3f-mcp-injections__">` alongside scene children.
- Added `sucrase` as a runtime dependency for browser-side JSX transformation.
- New `SceneBridge` handlers: `onInjectCode`, `onRemoveInjection`, `onGetInjections`.

#### `r3f-mcp-server` (server)

- `WebSocketManager` gains an in-memory injection registry (populated on successful `inject_code`). Used by `commit_component` to write code to disk without a second round-trip.
- New `request*` methods: `requestInjectCode`, `requestRemoveInjection`, `requestListInjections`, `getInjectionCode`, `getInjectionRegistry`.

---

## [0.2.0] — 2026-04-30

### New tools

#### Add / Remove objects

- **`add_object`** — create a mesh, group, directional/point/spot/ambient light in the live scene. Supports 11 geometry types (`box`, `sphere`, `cylinder`, `cone`, `torus`, `plane`, `torusKnot`, `icosahedron`, `octahedron`, `ring`, `dodecahedron`) and 5 material types (`standard`, `basic`, `phong`, `lambert`, `physical`). Objects are created imperatively in Three.js outside React's reconciler; the `onEdit` callback notifies the host app so it can sync state.
- **`remove_object`** — remove an object and all its children; recursively disposes geometry and materials to prevent memory leaks. Refuses to remove the scene root or cameras.

#### Spatial queries

- **`query_bounds`** — returns the world-space axis-aligned bounding box of any object: `min`, `max`, `center`, and `size` (w/h/d). Computed browser-side with `THREE.Box3.setFromObject`.
- **`query_distance`** — measures world-space distance between two objects; returns the scalar distance, both world positions, and the unit direction vector.
- **`query_frustum`** — lists every object currently inside the camera's view frustum. Uses `THREE.Frustum` built from the camera's projection matrix. Accepts an optional camera identifier to test against a non-default camera.

#### Scene diffing

- **`scene_diff`** — compares the current scene to the last snapshot (stored after any `scene_graph` or `scene_diff` call). Reports added objects, removed objects, and modified properties (position, rotation, scale, visibility, material color/opacity/wireframe, light color/intensity) with before/after values. Uses approximate float equality to avoid false positives from floating-point rounding.

### `r3f-mcp` (client)

- Added `createObject()` and `destroyObject()` to `SceneSerializer` — imperative Three.js object construction from a typed payload spec, and safe recursive disposal.
- Added `SceneBridge` handlers for all five new server→client message types (`add_object`, `remove_object`, `query_bounds`, `query_distance`, `query_frustum`).
- `MCPProvider` now imports Three.js value classes (`Box3`, `Vector3`, `Frustum`, `Matrix4`) for spatial computation.
- `screenshotQuality` prop is no longer applied (screenshots are lossless PNG); prop is retained for backwards compatibility.

### `r3f-mcp-server` (server)

- `WebSocketManager` gains `storeSnapshot()` / `getLastSnapshot()` for scene diff state, plus five new `request*` methods.
- `scene_graph` now stores a snapshot on every call so the first `scene_diff` has a baseline.
- Handshake protocol added: every new WebSocket connection must send `{"type":"handshake","client":"r3f-mcp-provider"}` within 5 seconds to be accepted. This prevents Claude Desktop's internal WebKit process from stealing the browser's connection slot.
- `index.ts` bumped to `version: '0.2.0'`.

---

## [0.1.0] — 2026-04-30

### Initial release

#### `r3f-mcp` (client)

- **`<MCPProvider>`** — drop-in R3F component that bridges the Three.js scene to the MCP server over a local WebSocket
  - `port` prop (default `3333`)
  - `readOnly` mode — blocks all mutation tools
  - `include` / `exclude` lists — filter which scene objects are visible to AI tools
  - `screenshotQuality` — quality hint for screenshot captures (0–1); currently no-op since screenshots are lossless PNG
  - `onEdit` callback — notified after every successful mutation
  - `onStatus` callback — notified on every connection lifecycle event

- **`useMCPStatus()`** hook — reads the live MCP connection state from any component, inside or outside `<Canvas>`:
  - `status` — `'disconnected' | 'connecting' | 'connected' | 'reconnecting' | 'error'`
  - `connectedAt` — `Date | null` (set when `status === 'connected'`)
  - `lastError` — `string | null` (set on `status === 'error'`)
  - Works across React renderer boundaries via a `useSyncExternalStore`-backed module-level store

- **`<MCPStatusIndicator>`** — self-contained colored dot with a native tooltip; reads from `useMCPStatus()` automatically:
  - 🟢 Green — connected
  - 🟡 Amber — connecting / reconnecting
  - 🔴 Red — error
  - ⚫ Gray — disconnected
  - `size` and `showLabel` props

- **`SceneBridge`** — low-level WebSocket client class for advanced usage

- **`MCPContext`** — React context provided by `<MCPProvider>` for direct `useContext` access within the Canvas tree

#### `r3f-mcp-server` (server)

- **MCP server** over stdio — compatible with Claude Desktop, Cursor, and any MCP-speaking AI tool
- **WebSocket server** that accepts a single `<MCPProvider>` browser connection
- Request/response protocol with per-request correlation IDs and 10-second timeouts

**Tools:**

| Tool | Description |
|---|---|
| `scene_graph` | Returns the complete Three.js scene tree with transforms, geometry, materials, lights, and cameras |
| `get_object` | Fetches a single object by UUID or name |
| `set_transform` | Sets position, rotation, and/or scale on any Object3D |
| `set_material` | Updates material color, opacity, metalness, roughness, wireframe, emissive, and transparency |
| `set_visible` | Shows or hides an object (and its descendants) |
| `screenshot` | Captures the current frame as a base64 PNG; saves to a temp file and returns the image inline |

- `--port` / `-p` CLI flag (default `3333`)
- Zod validation on all tool inputs with descriptive error messages
- Graceful shutdown on `SIGINT` / `SIGTERM`
