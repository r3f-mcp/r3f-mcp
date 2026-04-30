#!/usr/bin/env node
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';

import { WebSocketManager } from './connection.js';

import {
  sceneGraphTool,
  sceneGraphSchema,
  handleSceneGraph,
} from './tools/sceneGraph.js';
import {
  getObjectTool,
  getObjectSchema,
  handleGetObject,
} from './tools/getObject.js';
import {
  setTransformTool,
  setTransformSchema,
  handleSetTransform,
} from './tools/setTransform.js';
import {
  setMaterialTool,
  setMaterialSchema,
  handleSetMaterial,
} from './tools/setMaterial.js';
import {
  setVisibleTool,
  setVisibleSchema,
  handleSetVisible,
} from './tools/setVisible.js';
import {
  screenshotTool,
  screenshotSchema,
  handleScreenshot,
} from './tools/screenshot.js';

// ─── CLI ──────────────────────────────────────────────────────────────────────

function getPort(): number {
  const args = process.argv.slice(2);
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--port' || args[i] === '-p') {
      const n = parseInt(args[i + 1] ?? '', 10);
      if (!isNaN(n) && n > 0 && n < 65536) return n;
    }
  }
  return 3333;
}

// ─── Tool manifest ────────────────────────────────────────────────────────────

const ALL_TOOLS = [
  sceneGraphTool,
  getObjectTool,
  setTransformTool,
  setMaterialTool,
  setVisibleTool,
  screenshotTool,
];

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  const port = getPort();

  // ── WebSocket bridge (browser ↔ server) ─────────────────────────────────────
  const manager = new WebSocketManager({ port });

  // ── MCP server (Claude / Cursor ↔ server via stdio) ─────────────────────────
  const mcpServer = new Server(
    {
      name:    'r3f-mcp',
      version: '0.1.0',
    },
    {
      capabilities: { tools: {} },
      instructions:
        'This server connects AI tools to a running React Three Fiber scene. ' +
        'Before calling any tool, make sure the browser app with <MCPProvider> is running ' +
        `and connected to ws://localhost:${port}. ` +
        'Start with the scene_graph tool to understand the scene structure.',
    },
  );

  // ── List tools ───────────────────────────────────────────────────────────────
  mcpServer.setRequestHandler(ListToolsRequestSchema, async () => ({
    tools: ALL_TOOLS,
  }));

  // ── Dispatch tool calls ───────────────────────────────────────────────────────
  mcpServer.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: rawArgs = {} } = request.params;

    try {
      switch (name) {
        // ── scene_graph ───────────────────────────────────────────────────────
        case 'scene_graph': {
          const args = sceneGraphSchema.parse(rawArgs);
          const result = await handleSceneGraph(args, manager);
          return {
            content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
          };
        }

        // ── get_object ────────────────────────────────────────────────────────
        case 'get_object': {
          const args = getObjectSchema.parse(rawArgs);
          const result = await handleGetObject(args, manager);
          return {
            content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
          };
        }

        // ── set_transform ─────────────────────────────────────────────────────
        case 'set_transform': {
          const args = setTransformSchema.parse(rawArgs);
          const success = await handleSetTransform(args, manager);
          return {
            content: [{
              type: 'text',
              text: success
                ? `Transform applied to "${args.identifier}"`
                : `Failed to apply transform to "${args.identifier}"`,
            }],
          };
        }

        // ── set_material ──────────────────────────────────────────────────────
        case 'set_material': {
          const args = setMaterialSchema.parse(rawArgs);
          const success = await handleSetMaterial(args, manager);
          return {
            content: [{
              type: 'text',
              text: success
                ? `Material updated on "${args.identifier}"`
                : `Failed to update material on "${args.identifier}"`,
            }],
          };
        }

        // ── set_visible ───────────────────────────────────────────────────────
        case 'set_visible': {
          const args = setVisibleSchema.parse(rawArgs);
          const success = await handleSetVisible(args, manager);
          return {
            content: [{
              type: 'text',
              text: success
                ? `"${args.identifier}" is now ${args.visible ? 'visible' : 'hidden'}`
                : `Failed to change visibility of "${args.identifier}"`,
            }],
          };
        }

        // ── screenshot ────────────────────────────────────────────────────────
        case 'screenshot': {
          const args = screenshotSchema.parse(rawArgs);
          // handleScreenshot returns the MCP image content block directly.
          return await handleScreenshot(args, manager);
        }

        default:
          return {
            isError: true,
            content: [{ type: 'text', text: `Unknown tool: ${name}` }],
          };
      }
    } catch (err) {
      // All errors — validation failures, timeouts, not-found — surface as
      // readable MCP error responses so the AI can adapt.
      const message = err instanceof Error ? err.message : String(err);
      return {
        isError: true,
        content: [{ type: 'text', text: message }],
      };
    }
  });

  // ── Boot sequence ─────────────────────────────────────────────────────────
  await manager.listen();

  const transport = new StdioServerTransport();
  await mcpServer.connect(transport);

  // ── Graceful shutdown ────────────────────────────────────────────────────
  const shutdown = async () => {
    await manager.close();
    process.exit(0);
  };

  process.once('SIGINT',  () => { void shutdown(); });
  process.once('SIGTERM', () => { void shutdown(); });
}

main().catch((err: unknown) => {
  console.error('[r3f-mcp] Fatal error:', err instanceof Error ? err.message : err);
  process.exit(1);
});
