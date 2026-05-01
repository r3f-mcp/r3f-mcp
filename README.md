# r3f-mcp

Connect AI coding tools (Claude, Cursor, Copilot) to a **live React Three Fiber scene** via the [Model Context Protocol](https://modelcontextprotocol.io).

AI tools can inspect the full scene graph, move and resize objects, change materials, create and delete objects, measure distances and bounding boxes, query the camera frustum, capture screenshots, generate and inject new components in real time, and scaffold entire projects from scratch.

```
Claude Desktop / Cursor
      ↕  MCP (stdio)
r3f-mcp-server  ←── npx r3f-mcp-server
      ↕  WebSocket (localhost:3333)
<MCPProvider>   ←── inside your R3F <Canvas>
      ↕  useThree / Three.js
Your scene
```

---

## Packages

| Package | npm | Description |
|---|---|---|
| [`r3f-mcp`](./packages/client) | `npm install r3f-mcp` | React component + hooks |
| [`r3f-mcp-server`](./packages/server) | `npm install -g r3f-mcp-server` | MCP server binary |

---

## Quick start

### 1. Wrap your scene

```bash
npm install r3f-mcp
```

```tsx
import { Canvas } from '@react-three/fiber';
import { MCPProvider } from 'r3f-mcp';

export function App() {
  return (
    // preserveDrawingBuffer is required for screenshot capture
    <Canvas gl={{ preserveDrawingBuffer: true }}>
      <MCPProvider port={3333}>
        {/* your scene */}
      </MCPProvider>
    </Canvas>
  );
}
```

### 2. Start the MCP server

```bash
npx r3f-mcp-server --port 3333
```

### 3. Connect your AI tool

**Claude Desktop** — edit `~/Library/Application Support/Claude/claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "r3f-mcp": {
      "command": "npx",
      "args": ["r3f-mcp-server", "--port", "3333"]
    }
  }
}
```

**Cursor** — add to `.cursor/mcp.json` in your project root:

```json
{
  "mcpServers": {
    "r3f-mcp": {
      "command": "npx",
      "args": ["r3f-mcp-server", "--port", "3333"]
    }
  }
}
```

Restart your AI tool, then try the prompts below.

---

## Create with AI — live component injection *(v0.4)*

r3f-mcp isn't just an inspector — it's a creative engine. Describe what you want and watch it appear in your browser in real time.

> "Build me a particle system with 200 spheres orbiting the center"

A complete React component is generated (aware of your scene's existing positions and style) and injected into the running browser — **no file write, no dev server restart, no copy-paste**. If the first attempt has a bug, Claude sees the error and self-corrects automatically.

> "Make the particles glow and add a pulse animation"

Claude modifies the code and re-injects, replacing the previous version.

> "Save that as a component in my project"

`commit_component` writes the file and returns the import line. One step from prompt to permanent code.

> "Create an entire 3D portfolio site with floating project cards and a starfield background"

`scaffold_project` generates a complete, runnable R3F project to disk — including all your custom components — in a single tool call.

---

## What the AI can do

### Read the scene

> "What objects are in my Three.js scene?"
> "Show me the full scene tree with all transforms and materials."
> "What are the properties of the RedBox mesh?"

### Mutate objects

> "Move the RedBox to position [0, 2, 0]."
> "Rotate the camera 45 degrees on the Y axis."
> "Make the sphere 50% transparent and blue."
> "Hide all the helper arrows."

### Add and remove objects *(v0.2)*

> "Add a purple dodecahedron at position [0, 3, 0]."
> "Create a ring of 6 point lights evenly spaced around the origin."
> "Remove the GreenTorus from the scene."

### Spatial queries *(v0.2)*

> "How big is the player model? What are its world-space dimensions?"
> "How far apart are the RedBox and BlueSphere?"
> "What objects can the camera currently see?"

### Scene diffing *(v0.2)*

> "What changed in the scene since you last looked?"
> "Did anything move while I was editing the code?"

### Animation, physics & performance *(v0.3)*

> "What animations are currently playing?"
> "Pause the spinning animation on the RedBox."
> "What are the physics bodies in the scene?"
> "What's the current FPS? Profile it for 5 seconds."

### Code generation & live injection *(v0.4)*

> "Build me a glowing particle system that reacts to mouse position."
> "Create a space shooter where asteroids fly toward the camera."
> "Add a floating price tag that bounces gently above the sneaker model."
> "Scaffold a new project: a 3D portfolio with floating cards and a starfield."

### Screenshot

> "Take a screenshot of the current rendered frame."

---

## Built-in creative coding knowledge base *(v0.4)*

`r3f_reference` is an embedded expert knowledge base covering 14 topics. Claude reads it before generating components to produce professional-quality output automatically.

```
> "Before generating this component, check r3f_reference for materials and lighting tips"
```

Covered topics: `materials` · `lighting` · `animation` · `post-processing` · `camera` · `physics` · `particles` · `text` · `shaders` · `performance` · `composition` · `interactivity` · `audio` · `environment`

Each topic contains pro tips, code recipes, and common pitfalls — the difference between a flat grey sphere and a properly lit, physically-based, animated scene.

**Quality validation:** `inject_code` automatically scans submitted code for common issues before injecting:

- `meshBasicMaterial` on visible geometry → suggests `meshStandardMaterial`
- No lighting or environment in the component → flags potential flat appearance
- `useFrame` mutations without `delta` parameter → warns about frame-rate dependence
- Individual `<mesh>` in a loop → suggests `instancedMesh` for performance
- High-poly sphere geometry on small objects → suggests lower segment count

Warnings are returned to Claude so it can self-correct before the component is committed.

---

## Tools

| Tool | Version | Inputs | Description |
|---|---|---|---|
| `scene_graph` | v0.1 | — | Full scene tree — transforms, geometry, materials, lights, cameras. Result cached for `scene_diff`. |
| `get_object` | v0.1 | `identifier` | Detailed properties of one object by name or UUID |
| `set_transform` | v0.1 | `identifier`, `position?`, `rotation?`, `scale?` | Move / rotate / scale any Object3D |
| `set_material` | v0.1 | `identifier`, `color?`, `opacity?`, `transparent?`, `metalness?`, `roughness?`, `wireframe?`, `emissive?`, `emissiveIntensity?` | Update material properties |
| `set_visible` | v0.1 | `identifier`, `visible` | Show or hide an object (and its descendants) |
| `screenshot` | v0.1 | `width?`, `height?` | Capture current frame as PNG; saves to `/tmp/r3f-screenshot-{ts}.png` and returns inline |
| `add_object` | v0.2 | `name`, `type`, `position?`, `rotation?`, `scale?`, `parent?`, `geometry?`, `material?`, light props… | Create a mesh, group, or light in the live scene |
| `remove_object` | v0.2 | `identifier` | Remove an object and all children; disposes geometry/materials |
| `query_bounds` | v0.2 | `identifier` | World-space AABB — returns `min`, `max`, `center`, `size` |
| `query_distance` | v0.2 | `from`, `to` | World-space distance, both positions, direction vector |
| `query_frustum` | v0.2 | `camera?` | List every object visible in the camera's view frustum |
| `scene_diff` | v0.2 | — | Compare current scene to last snapshot — shows added, removed, modified |
| `get_animations` | v0.3 | `identifier?` | List all active AnimationMixer animations |
| `control_animation` | v0.3 | `target`, `action`, `time?`, `animationName?` | Play / pause / stop / seek an animation |
| `get_physics` | v0.3 | `identifier?` | Read Rapier rigid body / collider / joint state (requires `useRegisterPhysics`) |
| `get_performance` | v0.3 | — | Current FPS, draw calls, triangle count, memory |
| `get_performance_profile` | v0.3 | `duration?` | Profile for N seconds; returns min/max/p99 FPS, heaviest meshes, recommendations |
| `r3f_reference` | v0.4 | `topics` | Embedded expert knowledge base — materials, lighting, animation, shaders, and more |
| `generate_component` | v0.4 | `description`, `name`, `position?`, `preview?` | Scene-aware component generation with quality guidelines baked in |
| `inject_code` | v0.4 | `code`, `name?`, `replace?` | Live JSX injection with quality validation. Errors returned for self-correction. |
| `commit_component` | v0.4 | `name`, `directory?`, `filename?` | Save a live-preview injection to a `.tsx` file on disk |
| `scaffold_project` | v0.4 | `description`, `directory`, `template?`, `features?`, `components?` | Generate a complete R3F project to disk, including all custom components |
| `list_injections` | v0.4 | — | List all active live-preview components |
| `remove_injection` | v0.4 | `name` | Remove a live-preview component from the scene |

### `add_object` geometry types

`box` · `sphere` · `cylinder` · `cone` · `torus` · `plane` · `torusKnot` · `icosahedron` · `octahedron` · `ring` · `dodecahedron`

### `add_object` material types

`standard` (default) · `basic` · `phong` · `lambert` · `physical`

### `scaffold_project` — single-call workflow

The recommended pattern is to generate all component code first, then pass it in the `components` array so the entire project is written in one call:

```
components: [
  { name: "SpaceShip", description: "Player ship", code: "export default function SpaceShip() { ... }" },
  { name: "Asteroid",  description: "Enemy rock",  code: "export default function Asteroid() { ... }" }
]
```

This avoids the two-step workflow of scaffolding and then writing components separately.

---

## `<MCPProvider>` props

```tsx
<MCPProvider
  port={3333}                // WebSocket port (default: 3333)
  readOnly={false}           // Block all mutation tools (default: false)
  include={['Mesh']}         // Allowlist: only expose objects matching these names/types
  exclude={['AxesHelper']}   // Denylist: hide objects matching these names/types
  onEdit={(edit) => {}}      // Callback after every successful mutation or add/remove
  onStatus={(status) => {}}  // Callback on every connection lifecycle event
>
  {children}
</MCPProvider>
```

> **`screenshotQuality`** was a JPEG-era prop and has no effect now that screenshots are lossless PNG. The prop is kept for backwards compatibility.

---

## Connection status

### `useMCPStatus()` hook

Works from **any** component — inside or outside `<Canvas>`:

```tsx
import { useMCPStatus } from 'r3f-mcp';

function StatusBar() {
  const { status, connectedAt, lastError } = useMCPStatus();
  return (
    <div>
      MCP: {status}
      {connectedAt && ` · connected since ${connectedAt.toLocaleTimeString()}`}
      {lastError && ` · ${lastError}`}
    </div>
  );
}
```

| Field | Type | Description |
|---|---|---|
| `status` | `'disconnected' \| 'connecting' \| 'connected' \| 'reconnecting' \| 'error'` | Current connection state |
| `connectedAt` | `Date \| null` | Timestamp of the last successful connection; null when not connected |
| `lastError` | `string \| null` | Error message from the most recent `'error'` event; null otherwise |

### `<MCPStatusIndicator>`

Self-contained colored dot with a native tooltip. Works anywhere in your UI:

```tsx
import { MCPStatusIndicator } from 'r3f-mcp';

<MCPStatusIndicator />                     // dot + tooltip only
<MCPStatusIndicator size={12} showLabel /> // dot + status text
```

🟢 Green — connected &nbsp;·&nbsp; 🟡 Amber — connecting / reconnecting (animates) &nbsp;·&nbsp; 🔴 Red — error &nbsp;·&nbsp; ⚫ Gray — disconnected

---

## Physics integration

Register your Rapier world so `get_physics` can read it:

```tsx
import { useRapier } from '@react-three/rapier';
import { useRegisterPhysics } from 'r3f-mcp';

function PhysicsScene() {
  const { world } = useRapier();
  useRegisterPhysics(world); // one line to enable physics inspection
  return <>{children}</>;
}
```

---

## Animation inspection

Register animation mixers for `get_animations` and `control_animation`:

```tsx
import { useAnimations } from '@react-three/drei';
import { useRegisterAnimation } from 'r3f-mcp';

function AnimatedModel({ url }) {
  const { scene, animations } = useGLTF(url);
  const { ref, mixer } = useAnimations(animations, scene);
  useRegisterAnimation(ref.current, mixer); // register for MCP control
  return <primitive ref={ref} object={scene} />;
}
```

Objects that store their mixer in `object.userData.mixer` are also detected automatically.

---

## Object naming

Name your meshes so AI tools can find them by name instead of UUID:

```tsx
<mesh name="RedBox" position={[0, 1, 0]}>
  <boxGeometry args={[1, 1, 1]} />
  <meshStandardMaterial color="red" />
</mesh>
```

Unnamed objects are still accessible via their Three.js UUID, which appears in `scene_graph` output.

---

## Development

```bash
# Clone and install
git clone https://github.com/r3f-mcp/r3f-mcp.git
cd r3f-mcp
pnpm install

# Build both packages
pnpm build

# Run the example (starts Vite + MCP server concurrently)
cd examples/basic
pnpm dev
```

### Workspace scripts

| Command | Description |
|---|---|
| `pnpm build` | Build both packages |
| `pnpm build:client` | Build `r3f-mcp` only |
| `pnpm build:server` | Build `r3f-mcp-server` only |
| `pnpm typecheck` | Type-check both packages |
| `pnpm example` | Start the basic example |

### Example scripts

```bash
cd examples/basic
pnpm dev          # Vite dev server + MCP server (port 3333)
pnpm dev:app      # Vite only
pnpm dev:mcp      # MCP server only (tsx watch, no build step required)
```

---

## How it works

**`MCPProvider`** is a zero-geometry R3F component that:

1. Opens a `SceneBridge` WebSocket connection to the MCP server on mount, sending an identification handshake to prevent Claude Desktop's internal WebKit process from stealing the connection slot
2. Registers typed handlers for every server command:
   - *Read*: serializes the Three.js `Scene` into a `SerializedNode` JSON tree
   - *Mutations*: finds the target by UUID or name, applies the change, calls `invalidate()` to re-render
   - *Add/Remove*: creates or destroys Three.js objects imperatively; disposes geometry and materials on removal
   - *Spatial queries*: uses `Box3`, `Vector3`, and `Frustum` to compute bounds, distances, and frustum membership in the browser
   - *Live injection*: evaluates TSX with sucrase + `new Function`, mounts inside `InjectionErrorBoundary`; render errors are caught and reported back to Claude for self-correction
   - *Screenshot*: calls `gl.render(scene, camera)` then `canvas.toDataURL('image/png')`
3. Tracks per-frame render stats with `useFrame` so `get_performance` always returns current data

**`r3f-mcp-server`** (the Node.js binary):

1. Binds a WebSocket server; only accepts connections that send the `r3f-mcp-provider` handshake within 5 seconds (prevents tool conflicts with Claude Desktop's WebKit process)
2. Accepts tool calls from Claude/Cursor via stdio (Model Context Protocol)
3. Translates each tool call into a typed WebSocket message, awaits the browser response (10 s timeout; extended for profiling)
4. `inject_code` runs a quality validator before injection, flagging common issues (flat materials, missing delta, loop-per-mesh, high polygon counts) so Claude can self-improve
5. `r3f_reference` returns embedded expert knowledge on materials, lighting, animation, and more — read before generation for professional output
6. `scaffold_project` and `commit_component` write directly to the local filesystem; responses include absolute paths and `fs.existsSync` verification to prevent Claude from second-guessing what was written
7. Returns results as MCP text or image content blocks

---

## License

MIT © 2026
