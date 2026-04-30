# Changelog

All notable changes to this project will be documented here.

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
