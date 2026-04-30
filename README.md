# r3f-mcp

Connect AI coding tools (Claude, Cursor, Copilot) to a **live React Three Fiber scene** via the [Model Context Protocol](https://modelcontextprotocol.io).

AI tools can read the scene graph, inspect individual objects, move and resize meshes, change materials, toggle visibility, and capture screenshots — all without touching your source code.

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
    // preserveDrawingBuffer enables screenshot capture
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

Restart your AI tool, then ask it something like:

> "What objects are in my Three.js scene?"
> "Move the RedBox to position [0, 2, 0]"
> "Make the sphere 50% transparent and blue"
> "Take a screenshot of the current scene"

---

## Tools

The MCP server exposes six tools to AI assistants:

| Tool | Inputs | Description |
|---|---|---|
| `scene_graph` | — | Full scene tree with all transforms, geometry, materials |
| `get_object` | `identifier` | Detailed properties of one object by name or UUID |
| `set_transform` | `identifier`, `position?`, `rotation?`, `scale?` | Move/rotate/scale any Object3D |
| `set_material` | `identifier`, `color?`, `opacity?`, `metalness?`, `roughness?`, `wireframe?`, `transparent?`, `emissive?` | Change material properties |
| `set_visible` | `identifier`, `visible` | Show or hide an object |
| `screenshot` | `width?`, `height?` | Capture current frame as JPEG |

---

## `<MCPProvider>` props

```tsx
<MCPProvider
  port={3333}                // WebSocket port (default: 3333)
  readOnly={false}           // Block all mutations (default: false)
  include={['Mesh']}         // Only expose matching names/types
  exclude={['AxesHelper']}   // Hide matching names/types
  screenshotQuality={0.8}    // JPEG quality 0–1 (default: 0.8)
  onEdit={(edit) => {}}      // Called after every successful mutation
  onStatus={(status) => {}}  // Called on every connection event
>
  {children}
</MCPProvider>
```

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
| `connectedAt` | `Date \| null` | When the connection was established; null when not connected |
| `lastError` | `string \| null` | Last error message; null when no error |

### `<MCPStatusIndicator>`

Drop-in colored dot with a native tooltip. Place it anywhere in your UI:

```tsx
import { MCPStatusIndicator } from 'r3f-mcp';

// Minimal — just a dot with tooltip
<MCPStatusIndicator />

// Larger dot + status label
<MCPStatusIndicator size={12} showLabel />
```

- 🟢 Green — connected
- 🟡 Amber — connecting / reconnecting (animates)
- 🔴 Red — error
- ⚫ Gray — disconnected

---

## Object naming

Set `name` on your meshes so AI tools can find them by name:

```tsx
<mesh name="RedBox" position={[0, 1, 0]}>
  <boxGeometry args={[1, 1, 1]} />
  <meshStandardMaterial color="red" />
</mesh>
```

Claude can then use `set_transform({ identifier: "RedBox", position: [0, 2, 0] })`.
Objects without names are accessible via their Three.js UUID (visible in `scene_graph` output).

---

## Development

```bash
# Clone and install
git clone https://github.com/your-org/r3f-mcp.git
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
pnpm dev:mcp      # MCP server only
```

---

## How it works

`MCPProvider` is an R3F component that:
1. Creates a `SceneBridge` WebSocket client that connects to the MCP server
2. Registers handlers for each tool call type
3. On `scene_graph`: serializes the Three.js `Scene` object into a JSON tree
4. On mutations: finds the target object, applies the change, calls `gl.invalidate()` to re-render
5. On `screenshot`: calls `gl.render(scene, camera)` then `canvas.toDataURL('image/jpeg')`

The MCP server (`r3f-mcp-server`):
1. Listens for tool calls from Claude/Cursor over stdio
2. Forwards them as WebSocket messages to the browser
3. Awaits the response with a 10-second timeout
4. Returns the result formatted as MCP content (text or image)

---

## License

MIT © 2026
