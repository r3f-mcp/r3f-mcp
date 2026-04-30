# Changelog

All notable changes to this project will be documented here.

## [0.1.0] — 2026-04-30

### Initial release

#### `r3f-mcp` (client)

- **`<MCPProvider>`** — drop-in R3F component that bridges the Three.js scene to the MCP server over a local WebSocket
  - `port` prop (default `3333`)
  - `readOnly` mode — blocks all mutation tools
  - `include` / `exclude` lists — filter which scene objects are visible to AI tools
  - `screenshotQuality` — JPEG quality for screenshot captures (0–1)
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
| `screenshot` | Captures the current frame as a base64 JPEG |

- `--port` / `-p` CLI flag (default `3333`)
- Zod validation on all tool inputs with descriptive error messages
- Graceful shutdown on `SIGINT` / `SIGTERM`
