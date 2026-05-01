# r3f-mcp

Connect AI coding tools (Claude, Cursor, Copilot) to a **live React Three Fiber scene** via the [Model Context Protocol](https://modelcontextprotocol.io).

AI tools can inspect the full scene graph, move and resize objects, change materials, create and delete objects, measure distances and bounding boxes, query the camera frustum, and capture screenshots — all without touching your source code.

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

Restart your AI tool, then try natural-language prompts like the ones below.

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

`scaffold_project` generates a complete, runnable R3F project to disk with `package.json`, Vite config, TypeScript, and a canvas pre-wired with `MCPProvider` so the AI can continue iterating.

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
> "Delete all objects whose name starts with 'debug_'."

### Spatial queries *(v0.2)*

> "How big is the player model? What are its world-space dimensions?"
> "How far apart are the RedBox and BlueSphere?"
> "What objects can the camera currently see?"

### Scene diffing *(v0.2)*

> "What changed in the scene since you last looked?"
> "Did anything move while I was editing the code?"

### Screenshot

> "Take a screenshot of the current rendered frame."

---

## Tools

### v0.4 — Code generation & live injection

| Tool | Inputs | Description |
|---|---|---|
| `generate_component` | `description`, `name`, `position?`, `preview?` | Scene-aware component generation — fetches scene graph, returns context + instructions for Claude to generate and inject a fitting component |
| `inject_code` | `code`, `name?`, `replace?` | Evaluate and mount TSX/JSX in the running browser immediately. Errors are returned to Claude for self-correction. |
| `commit_component` | `name`, `directory?`, `filename?` | Save a live-preview injection to an actual `.tsx` file. Returns the import line and JSX snippet. |
| `scaffold_project` | `description`, `directory`, `template?`, `features?` | Generate a complete, runnable R3F project to disk. |
| `list_injections` | — | List all active live-preview components |
| `remove_injection` | `name` | Remove a live-preview component from the scene |

### All tools

| Tool | Inputs | Description |
|---|---|---|
| `scene_graph` | — | Full scene tree — transforms, geometry, materials, lights, cameras. Result is cached for `scene_diff`. |
| `get_object` | `identifier` | Detailed properties of one object by name or UUID |
| `set_transform` | `identifier`, `position?`, `rotation?`, `scale?` | Move / rotate / scale any Object3D |
| `set_material` | `identifier`, `color?`, `opacity?`, `transparent?`, `metalness?`, `roughness?`, `wireframe?`, `emissive?`, `emissiveIntensity?` | Update material properties |
| `set_visible` | `identifier`, `visible` | Show or hide an object (and its descendants) |
| `screenshot` | `width?`, `height?` | Capture the current frame as a PNG; saves to `/tmp/r3f-screenshot-{ts}.png` and returns the image inline |
| `add_object` | `name`, `type`, … | Create a mesh, group, or light in the live scene |
| `remove_object` | `identifier` | Remove an object and all its children; disposes geometry and materials |
| `query_bounds` | `identifier` | World-space AABB — returns `min`, `max`, `center`, `size` |
| `query_distance` | `from`, `to` | World-space distance between two objects |
| `query_frustum` | `camera?` | List every object currently visible in the camera's view frustum |
| `scene_diff` | — | Compare current scene to the last snapshot — shows added, removed, modified |
| `get_animations` | `identifier?` | List all active AnimationMixer animations |
| `control_animation` | `target`, `action`, `time?`, `animationName?` | Play / pause / stop / seek an animation |
| `get_physics` | `identifier?` | Read Rapier rigid body / collider / joint state |
| `get_performance` | — | Current FPS, draw calls, triangle count, memory |
| `get_performance_profile` | `duration?` | Profile for N seconds; returns min/max/p99 FPS, heaviest meshes, recommendations |
| `generate_component` | `description`, `name`, `position?` | Scene-aware component generation |
| `inject_code` | `code`, `name?`, `replace?` | Live JSX injection — appears instantly in the browser |
| `commit_component` | `name`, `directory?` | Save injection to a `.tsx` file |
| `scaffold_project` | `description`, `directory` | Generate a complete R3F project to disk |
| `list_injections` | — | List active live-preview components |
| `remove_injection` | `name` | Remove a live-preview component |
| `add_object` | `name`, `type`, `position?`, `rotation?`, `scale?`, `parent?`, `geometry?`, `material?`, light props… | Create a mesh, group, or light in the live scene |
| `remove_object` | `identifier` | Remove an object and all its children; disposes geometry and materials |
| `query_bounds` | `identifier` | World-space AABB — returns `min`, `max`, `center`, `size` |
| `query_distance` | `from`, `to` | World-space distance between two objects, plus their positions and direction vector |
| `query_frustum` | `camera?` | List every object currently visible in the camera's view frustum |
| `scene_diff` | — | Compare current scene to the last `scene_graph` / `scene_diff` snapshot — returns added, removed, and modified objects |

### `add_object` geometry types

`box` · `sphere` · `cylinder` · `cone` · `torus` · `plane` · `torusKnot` · `icosahedron` · `octahedron` · `ring` · `dodecahedron`

### `add_object` material types

`standard` (default) · `basic` · `phong` · `lambert` · `physical`

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

<MCPStatusIndicator />               // dot + tooltip only
<MCPStatusIndicator size={12} showLabel />  // dot + status text
```

🟢 Green — connected &nbsp;·&nbsp; 🟡 Amber — connecting / reconnecting (animates) &nbsp;·&nbsp; 🔴 Red — error &nbsp;·&nbsp; ⚫ Gray — disconnected

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

1. Opens a `SceneBridge` WebSocket connection to the MCP server on mount
2. Sends an identification handshake so the server can distinguish it from other
   processes (e.g. Claude Desktop's internal WebKit) that connect to the same port
3. Registers typed handlers for every server command:
   - *Read*: serializes the Three.js `Scene` object into a `SerializedNode` JSON tree
   - *Mutations*: finds the target by UUID or name, applies the change, calls `invalidate()` to re-render
   - *Add/Remove*: creates or destroys Three.js objects imperatively; disposes geometry and materials on removal
   - *Spatial queries*: uses `Box3`, `Vector3`, and `Frustum` from Three.js to compute bounds, distances, and frustum membership in the browser
   - *Screenshot*: calls `gl.render(scene, camera)` then `canvas.toDataURL('image/png')`

**`r3f-mcp-server`** (the Node.js binary):

1. Binds a WebSocket server and waits for a `MCPProvider` connection
2. Accepts tool calls from Claude/Cursor via stdio (Model Context Protocol)
3. Translates each tool call into a WebSocket message, awaits the response (10 s timeout)
4. For `scene_diff`: stores the last scene graph snapshot in memory and diffs it against the fresh one from the browser — comparing transforms, visibility, material properties, and light settings
5. Returns results as MCP text or image content blocks

---

## License

MIT © 2026
