# Changelog

All notable changes to this project will be documented here.

## [0.5.0] — 2026-05-01

### `r3f_reference` — comprehensive knowledge base expansion (22 topics)

Rewrote `r3f_reference` with content from the R3F Techniques Compendium. All 15 existing topics expanded; 7 new topics added.

**New topics:**

| Topic | Contents |
|---|---|
| `heuristics` | MCP generation defaults — selective bloom (lift colors > 1.0, not threshold=0), instancedMesh cutoff (~20), `frameloop="demand"`, ACES filmic last, Drei pre-built > hand-rolled, scene integration rules, explicit NEVER list |
| `architecture` | Layer model (DOM/Scene/Object/Shader), single-canvas rule, animation-through-refs vs setState, zustand/jotai/valtio comparison, key R3F hooks reference |
| `scroll` | `ScrollControls` + `useScroll`, GSAP timeline + `seek()` pattern, r3f-scroll-rig (GlobalCanvas, ScrollScene, useTracker), Lenis, `<View>` + `<View.Port>` |
| `models` | gltfjsx workflow, full compression pipeline (Draco, Meshopt, KTX2/UASTC/ETC1S, gltf-transform CLI), loading patterns, Gaussian splatting |
| `libraries` | Complete companion stack with version baseline: react-spring/three, framer-motion-3d, gsap, theatre.js, maath, use-gesture, leva, meshline, lygia, wawa-vfx, r3f-perf |
| `effects` | 30+ named creative effect recipes: scroll tubes, image reveals, caustics, holographic cards, galaxy, metaballs, iridescent crystal, audio-reactive; with reference sites |
| `webgpu` | TSL (Three Shader Language) full syntax, `WebGPURenderer` setup, compute shaders, `instancedArray`, storage textures, fallback path |

**Major expansions to existing topics:** cinematic material table in `materials`, shadow tiers table in `lighting`, animation pattern index in `animation`, selective bloom + N8AO + effect stacks in `post-processing`, full `shaderMaterial` code pattern + Lygia/glslify + Shadertoy porting in `shaders`, three-approach taxonomy (CPU/Instanced/GPGPU) + FBO architecture + VFX engines in `particles`, draw call targets + BatchedMesh + memory hygiene + shader micro-opts in `performance`, `InstancedRigidBodies` + ecctrl + sensor triggers in `physics`.

**`generate_component` quality guidelines updated** — reorganised into four sections (Materials, Animation, Structure, Scale & Geometry) with selective bloom technique, `damp`/`damp3` from `maath`, organic motion frequencies, and a scene-integration section ensuring generated components respect the existing scene's aesthetic.

---

## [0.4.4] — 2026-05-01

### `r3f_reference` — comprehensive knowledge base expansion

Completely rewrote the `r3f_reference` tool with content from the R3F Techniques Compendium. All existing topics were expanded and 7 new topics were added.

**Expanded existing topics:**

| Topic | What's new |
|---|---|
| `materials` | Full cinematic material table (glass, mirror, diamond, toon, goo, holographic), MeshTransmissionMaterial recipe |
| `lighting` | Three-lights-max rule, Lightformers recipe, shadow tiers table (5 levels from ContactShadows to lightmaps) |
| `animation` | Full pattern index table, `damp`/`damp3` from maath, GSAP timeline seek pattern, organic frequency tips |
| `post-processing` | Selective bloom technique (lift colors > 1.0), GodRays, Outline/Selection, N8AO, cinematic effect stacks |
| `shaders` | Full `shaderMaterial` code pattern, Lygia/glslify, Shadertoy porting guide, TSL preview |
| `particles` | Three-approach taxonomy (CPU/Instanced/GPGPU), FBO ping-pong architecture, wawa-vfx / three.quarks, Trails |
| `performance` | Draw call targets, BatchedMesh, memory hygiene, adaptive quality, shader micro-opts, tools (r3f-perf, Spector.js) |
| `physics` | `<InstancedRigidBodies>`, ecctrl character controller, joint hooks, sensor trigger volumes |
| `camera` | Controls taxonomy, scroll camera pattern, `<CubeCamera>`, fov guide |

**New topics:**

| Topic | Contents |
|---|---|
| `architecture` | Layer model (DOM/Scene/Object/Shader), single-canvas rule, animation-through-refs principle, zustand/jotai/valtio, key R3F hooks |
| `scroll` | `ScrollControls` + `useScroll`, GSAP timeline seek pattern, r3f-scroll-rig (GlobalCanvas, ScrollScene, useTracker), Lenis, `<View>` + `<View.Port>` |
| `models` | gltfjsx workflow, full compression pipeline (Draco, Meshopt, KTX2/UASTC/ETC1S, gltf-transform CLI), loading patterns, Gaussian splatting |
| `libraries` | Full companion stack with version baseline: react-spring/three, framer-motion-3d, gsap, theatre.js, maath, miniplex, leva, meshline, lygia, wawa-vfx, three.quarks |
| `effects` | 30+ concrete creative effect recipes: image reveals, scroll tubes, product grids, galaxy, metaballs, caustics, holographic cards, audio-reactive, reference sites |
| `heuristics` | **The most important new topic.** MCP-specific generation defaults: when to use bloom, instancing, frameloop, ACES filmic, Drei pre-built materials, GSAP vs manual math, and explicit NEVER list |
| `webgpu` | TSL (Three Shader Language) full syntax, `WebGPURenderer` setup, compute shaders, `instancedArray`, storage textures |

**`generate_component` quality guidelines updated** to incorporate the key heuristics: selective bloom, damp/damp3, organic motion frequencies, Drei pre-built material preference, and the scene-integration rules.

---

## [0.4.3] — 2026-05-01

### `scaffold_project` — dependency version fixes

Corrected all package versions in the generated `package.json` to match the current npm ecosystem. The previous versions caused `ERESOLVE` errors because the entire `@react-three/*` v9 ecosystem moved to React 19 and requires `three >=0.168.0`.

| Package | Old | New |
|---|---|---|
| `react` / `react-dom` | `^18.2.0` | `^19.0.0` |
| `three` | `^0.160.0` | `^0.184.0` |
| `@react-three/fiber` | `^8.15.0` | `^9.0.0` |
| `@react-three/drei` | `^9.0.0` | `^10.0.0` |
| `@react-three/postprocessing` | `^2.14.0` | `^3.0.0` |
| `@react-three/rapier` | `^1.5.0` | `^2.0.0` |
| `@dimforge/rapier3d-compat` | `^0.12.0` | `^0.19.0` |
| `@types/react` / `@types/react-dom` | `^18.2.0` | `^19.0.0` |
| `@types/three` | `^0.160.0` | `^0.184.0` |

The root cause of the `postprocessing` ERESOLVE: `postprocessing ^6.36` requires `three >=0.168.0 <0.185.0`, but the scaffold tool was generating `three ^0.160.0` which doesn't satisfy that range. `three ^0.184.0` is the latest version within the allowed window.

---

## [0.4.2] — 2026-05-01

### Context-aware scene environments for `scaffold_project`

#### Problem

Every scaffolded project previously received the same boilerplate scene: white-ish ground plane (`#e2e8f0`), generic ambient + directional lighting, and `[5, 5, 8]` camera — regardless of whether the project was a space simulator, an underwater world, or a product showcase. A solar system got a floor. An underwater scene got a grey ground plane. The output looked wrong.

#### Fix: `sceneEnvironment.ts` — shared environment profile module

A new shared module (`packages/server/src/tools/sceneEnvironment.ts`) classifies any project description into one of 8 environment profiles using keyword matching, then provides pre-built JSX fragments and metadata that both `scaffold_project` and `generate_component` use.

| Profile | Triggers | Key characteristics |
|---|---|---|
| **space** | "space", "solar", "planet", "galaxy", "asteroid", "cosmic"… | Black background. `<Stars>`. Point-light sun. **No ground.** Low ambient (0.05). Bloom for glow. |
| **underwater** | "underwater", "ocean", "sea", "aquatic", "coral"… | Deep teal (#0a2a3a). Heavy near-fog (1–30). Sandy sea floor. Blue directional from above. ChromaticAberration. |
| **product** | "product", "showcase", "sneaker", "watch", "furniture"… | Dark studio (#1a1a1a). `<Environment preset="studio">`. Three-point lighting. `<ContactShadows>`. Low fov (40). |
| **nature** | "forest", "garden", "landscape", "mountain", "terrain"… | Sky-blue background (#c9e2f0). `<Sky>`. Forest environment. Warm sun directional. Large grass floor. |
| **interior** | "room", "apartment", "office", "gallery", "museum"… | Warm dark (#1a1510). Eye-level camera (y=1.6). Spot lights with penumbra. Apartment environment. Wood floor. |
| **game** | "game", "shooter", "platformer", "rpg", "battle"… | Dark navy (#0a0a1a). Dramatic colored point lights. Elevated camera (y=8). Vignette + Bloom. |
| **abstract** | "abstract", "generative", "installation", "immersive"… | Near-black (#0a0a0a). **No ground.** Colored neon point lights only. Auto-rotating orbit. Heavy post-processing. |
| **portfolio** | "portfolio", "website", "landing page", "hero section"… | Near-black (#0f0f0f). **No ground.** City environment. Clean minimal. Zoom disabled on OrbitControls. |

Four rules enforced in every profile:
1. Background is never `#ffffff` — minimum dark neutral `#1a1a2e`
2. Fog color always matches background exactly
3. Space scenes never get a ground plane
4. `ambientLight` is always supplemented with directional/point/spot lighting

#### `generate_component` — style context injection

`generate_component` now calls `determineEnvironment(args.description)` and injects a `═══ STYLE CONTEXT ═══` block into the generation prompt before the scene summary. This gives Claude the color palette, material suggestions, and things to avoid *before* it writes any code — so a space component automatically gets dark emissive materials instead of a grey `MeshStandardMaterial`.

#### `r3f_reference` — new `scenes` topic

`r3fReference` now accepts `"scenes"` as a topic. It returns the full environment profile documentation in a reference format, including the four universal rules. Use it before generating components for a specific scene type:

```
> r3f_reference({ topics: ["scenes", "lighting"] })
```

---

## [0.4.1] — 2026-05-01

### Quality enhancements & generation improvements

#### New tool: `r3f_reference`

An embedded expert knowledge base that Claude reads before generating components. No network fetch — all content is hardcoded in the tool. Covers 14 topics with pro tips, code recipes, and common pitfalls:

| Topic | What it covers |
|---|---|
| `materials` | `meshStandardMaterial` defaults, glass/crystal with `MeshTransmissionMaterial`, emissive glow, metalness/roughness recipes |
| `lighting` | Three-point setup, environment presets, shadow configuration, `ContactShadows`, color temperature |
| `animation` | Delta-time independence, floating/bobbing patterns, spring animations, `useFrame` recipes, `<Float>` |
| `post-processing` | Bloom with `mipmapBlur`, cinematic/neon/dreamy recipes, ACES tone mapping, SMAA |
| `camera` | Position presets, `OrbitControls`/`PresentationControls`, animated camera paths, fov guide |
| `physics` | Rapier setup, body types, impulse, sensors, `useRegisterPhysics` |
| `particles` | `Points` for 5K+, `instancedMesh` with animation, additive blending, `<Sparkles>` |
| `text` | `Text3D`, billboard `<Text>`, `<Html>` overlays |
| `shaders` | `shaderMaterial` + `extend`, common GLSL patterns, `onBeforeCompile` |
| `performance` | Draw call budgets, `instancedMesh`, geometry merging, `useFrame` allocation tips |
| `composition` | Rule of thirds, depth layering, fog, camera height semantics, color palette |
| `interactivity` | Hover with spring, drag, cursor change, raycasting optimization, `<Html>` tooltips |
| `audio` | `PositionalAudio`, autoplay restrictions, Howler.js integration |
| `environment` | `<Environment>` presets, `<Sky>`, `<Stars>`, reflective floor, fog matching |

#### `inject_code` — quality validator

Before sending code to the browser, `inject_code` now scans the source for five common issues and returns warnings alongside the injection result:

| Rule | Trigger | Suggestion |
|---|---|---|
| `flat-material` | `meshBasicMaterial` on non-wireframe geometry | Switch to `meshStandardMaterial` with `metalness`/`roughness` |
| `no-lighting` | No light or `Environment` reference in the component | Add ambient + directional light or `<Environment preset="studio" />` |
| `no-delta` | `useFrame` mutates `.rotation`/`.position` without `delta` in the callback signature | Change to `(state, delta) =>` and multiply speeds by `delta` |
| `loop-mesh` | `<mesh>` created inside a `.map()`, `for`, or `Array.from` | Use `<instancedMesh>` (single draw call for thousands of objects) |
| `high-poly` | `<sphereGeometry>` with width or height segments > 24 | Reduce to 12×12 for small objects; high poly only needed for hero objects |

Warnings are returned to Claude so it can self-correct before calling `commit_component`.

#### `generate_component` — quality guidelines in context

The prompt returned by `generate_component` now includes an explicit quality checklist that Claude reads before writing code:

- Default to `meshStandardMaterial` with explicit `metalness`/`roughness`
- Always use `delta` in `useFrame` for frame-rate independence
- Use different `Math.sin`/`Math.cos` frequencies per axis for organic motion
- For particles/repeated geometry: `instancedMesh` or `Points` only
- Wrap objects in `<group>` for clean transform management
- Use `useRef<THREE.Mesh>(null)` type annotations

#### `scaffold_project` — `components` array input

`scaffold_project` now accepts a `components` array so the entire project — boilerplate and all custom components — is written in a single tool call:

```json
{
  "description": "a space shooter game",
  "directory": "~/projects/space-shooter",
  "components": [
    { "name": "SpaceShip", "description": "Player ship", "code": "export default function SpaceShip() { ... }" },
    { "name": "Asteroid",  "description": "Enemy rock",  "code": "export default function Asteroid() { ... }" }
  ]
}
```

Each component is written to `src/components/{Name}.tsx` and imported in the generated `App.tsx`. This eliminates the two-step workflow of scaffolding first and then separately writing or injecting components.

#### `scaffold_project` & `commit_component` — unambiguous filesystem responses

Both tools now return responses designed to prevent Claude from second-guessing what was written:

- Absolute paths in every file reference (never relative)
- `fs.existsSync` + `fs.statSync` verification with file sizes after writing
- IMPORTANT directive at the end of each response explicitly instructing Claude not to recreate or re-display the files
- `scaffold_project` resolves `~` and relative paths to absolute before any I/O, with a write-permission check on the parent directory before creating any files

---

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
