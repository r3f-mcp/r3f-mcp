#!/usr/bin/env node
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';

import { WebSocketManager } from './connection.js';

import { sceneGraphTool,  sceneGraphSchema,  handleSceneGraph  } from './tools/sceneGraph.js';
import { getObjectTool,   getObjectSchema,   handleGetObject   } from './tools/getObject.js';
import { setTransformTool,setTransformSchema,handleSetTransform} from './tools/setTransform.js';
import { setMaterialTool, setMaterialSchema, handleSetMaterial } from './tools/setMaterial.js';
import { setVisibleTool,  setVisibleSchema,  handleSetVisible  } from './tools/setVisible.js';
import { screenshotTool,  screenshotSchema,  handleScreenshot  } from './tools/screenshot.js';
import { addObjectTool,   addObjectSchema,   handleAddObject   } from './tools/addObject.js';
import { removeObjectTool,removeObjectSchema,handleRemoveObject} from './tools/removeObject.js';
import { queryBoundsTool, queryBoundsSchema, handleQueryBounds } from './tools/queryBounds.js';
import { queryDistanceTool,queryDistanceSchema,handleQueryDistance } from './tools/queryDistance.js';
import { queryFrustumTool, queryFrustumSchema,handleQueryFrustum  } from './tools/queryFrustum.js';
import { sceneDiffTool,         sceneDiffSchema,         handleSceneDiff         } from './tools/sceneDiff.js';
import { getAnimationsTool,    getAnimationsSchema,    handleGetAnimations    } from './tools/getAnimations.js';
import { controlAnimationTool, controlAnimationSchema, handleControlAnimation } from './tools/controlAnimation.js';
import { getPhysicsTool,       getPhysicsSchema,       handleGetPhysics       } from './tools/getPhysics.js';
import { getPerformanceTool,   getPerformanceSchema,   handleGetPerformance   } from './tools/getPerformance.js';
import { getPerformanceProfileTool, getPerformanceProfileSchema, handleGetPerformanceProfile } from './tools/getPerformanceProfile.js';
import { generateComponentTool, generateComponentSchema, handleGenerateComponent } from './tools/generateComponent.js';
import { injectCodeTool,         injectCodeSchema,        handleInjectCode         } from './tools/injectCode.js';
import { commitComponentTool,    commitComponentSchema,   handleCommitComponent    } from './tools/commitComponent.js';
import { scaffoldProjectTool,    scaffoldProjectSchema,   handleScaffoldProject    } from './tools/scaffoldProject.js';
import { listInjectionsTool,     listInjectionsSchema,    handleListInjections     } from './tools/listInjections.js';
import { removeInjectionTool,    removeInjectionSchema,   handleRemoveInjection    } from './tools/removeInjection.js';

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
  // v0.1 — read / inspect / mutate / capture
  sceneGraphTool,
  getObjectTool,
  setTransformTool,
  setMaterialTool,
  setVisibleTool,
  screenshotTool,
  // v0.2 — add / remove
  addObjectTool,
  removeObjectTool,
  // v0.2 — spatial queries
  queryBoundsTool,
  queryDistanceTool,
  queryFrustumTool,
  // v0.2 — scene diffing
  sceneDiffTool,
  // v0.3 — animation, physics, performance
  getAnimationsTool,
  controlAnimationTool,
  getPhysicsTool,
  getPerformanceTool,
  getPerformanceProfileTool,
  // v0.4 — live injection & code generation
  generateComponentTool,
  injectCodeTool,
  commitComponentTool,
  scaffoldProjectTool,
  listInjectionsTool,
  removeInjectionTool,
];

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  const port = getPort();

  const manager = new WebSocketManager({ port });

  const mcpServer = new Server(
    { name: 'r3f-mcp', version: '0.4.0' },
    {
      capabilities: { tools: {} },
      instructions:
        'This server connects AI tools to a running React Three Fiber scene. ' +
        'Before calling any tool, make sure the browser app with <MCPProvider> is running ' +
        `and connected to ws://localhost:${port}. ` +
        'Start with scene_graph to understand the structure, then use spatial queries or mutations.',
    },
  );

  // ── List tools ───────────────────────────────────────────────────────────────
  mcpServer.setRequestHandler(ListToolsRequestSchema, async () => ({ tools: ALL_TOOLS }));

  // ── Dispatch tool calls ───────────────────────────────────────────────────────
  mcpServer.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: rawArgs = {} } = request.params;

    try {
      switch (name) {

        // ── v0.1 ─────────────────────────────────────────────────────────────

        case 'scene_graph': {
          const args = sceneGraphSchema.parse(rawArgs);
          const result = await handleSceneGraph(args, manager);
          return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
        }

        case 'get_object': {
          const args = getObjectSchema.parse(rawArgs);
          const result = await handleGetObject(args, manager);
          return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
        }

        case 'set_transform': {
          const args = setTransformSchema.parse(rawArgs);
          const success = await handleSetTransform(args, manager);
          return { content: [{ type: 'text', text: success
            ? `Transform applied to "${args.identifier}"`
            : `Failed to apply transform to "${args.identifier}"` }] };
        }

        case 'set_material': {
          const args = setMaterialSchema.parse(rawArgs);
          const success = await handleSetMaterial(args, manager);
          return { content: [{ type: 'text', text: success
            ? `Material updated on "${args.identifier}"`
            : `Failed to update material on "${args.identifier}"` }] };
        }

        case 'set_visible': {
          const args = setVisibleSchema.parse(rawArgs);
          const success = await handleSetVisible(args, manager);
          return { content: [{ type: 'text', text: success
            ? `"${args.identifier}" is now ${args.visible ? 'visible' : 'hidden'}`
            : `Failed to change visibility of "${args.identifier}"` }] };
        }

        case 'screenshot': {
          const args = screenshotSchema.parse(rawArgs);
          return await handleScreenshot(args, manager);
        }

        // ── v0.2: add / remove ───────────────────────────────────────────────

        case 'add_object': {
          const args = addObjectSchema.parse(rawArgs);
          const result = await handleAddObject(args, manager);
          return { content: [{ type: 'text',
            text: `Created ${args.type} "${result.name}" — UUID: ${result.uuid}` }] };
        }

        case 'remove_object': {
          const args = removeObjectSchema.parse(rawArgs);
          const result = await handleRemoveObject(args, manager);
          return { content: [{ type: 'text',
            text: `Removed "${result.name}" (UUID: ${result.uuid})` }] };
        }

        // ── v0.2: spatial queries ─────────────────────────────────────────────

        case 'query_bounds': {
          const args = queryBoundsSchema.parse(rawArgs);
          const result = await handleQueryBounds(args, manager);
          return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
        }

        case 'query_distance': {
          const args = queryDistanceSchema.parse(rawArgs);
          const result = await handleQueryDistance(args, manager);
          return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
        }

        case 'query_frustum': {
          const args = queryFrustumSchema.parse(rawArgs);
          const result = await handleQueryFrustum(args, manager);
          return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
        }

        // ── v0.2: scene diffing ───────────────────────────────────────────────

        case 'scene_diff': {
          const args = sceneDiffSchema.parse(rawArgs);
          return await handleSceneDiff(args, manager);
        }

        // ── v0.3: animation ───────────────────────────────────────────────────

        case 'get_animations': {
          const args   = getAnimationsSchema.parse(rawArgs);
          const result = await handleGetAnimations(args, manager);
          return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
        }

        case 'control_animation': {
          const args   = controlAnimationSchema.parse(rawArgs);
          const result = await handleControlAnimation(args, manager);
          return {
            content: [{
              type: 'text',
              text: result.success
                ? `Animation "${result.animation}" is now ${result.state} at ${result.currentTime.toFixed(3)}s`
                : 'Failed to control animation',
            }],
          };
        }

        // ── v0.3: physics ─────────────────────────────────────────────────────

        case 'get_physics': {
          const args   = getPhysicsSchema.parse(rawArgs);
          const result = await handleGetPhysics(args, manager);
          return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
        }

        // ── v0.3: performance ─────────────────────────────────────────────────

        case 'get_performance': {
          const args   = getPerformanceSchema.parse(rawArgs);
          const result = await handleGetPerformance(args, manager);
          return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
        }

        case 'get_performance_profile': {
          const args = getPerformanceProfileSchema.parse(rawArgs);
          return await handleGetPerformanceProfile(args, manager);
        }

        // ── v0.4: code generation & live injection ────────────────────────────

        case 'generate_component': {
          const args = generateComponentSchema.parse(rawArgs);
          return await handleGenerateComponent(args, manager);
        }

        case 'inject_code': {
          const args = injectCodeSchema.parse(rawArgs);
          return await handleInjectCode(args, manager);
        }

        case 'commit_component': {
          const args = commitComponentSchema.parse(rawArgs);
          return await handleCommitComponent(args, manager);
        }

        case 'scaffold_project': {
          const args = scaffoldProjectSchema.parse(rawArgs);
          return await handleScaffoldProject(args, manager);
        }

        case 'list_injections': {
          const args   = listInjectionsSchema.parse(rawArgs);
          const result = await handleListInjections(args, manager);
          return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
        }

        case 'remove_injection': {
          const args   = removeInjectionSchema.parse(rawArgs);
          const result = await handleRemoveInjection(args, manager);
          return {
            content: [{
              type: 'text',
              text: result.success
                ? `Removed injection "${result.name}"`
                : `Failed to remove "${result.name}"`,
            }],
          };
        }

        default:
          return { isError: true, content: [{ type: 'text', text: `Unknown tool: ${name}` }] };
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return { isError: true, content: [{ type: 'text', text: message }] };
    }
  });

  // ── Boot ──────────────────────────────────────────────────────────────────────
  await manager.listen();
  const transport = new StdioServerTransport();
  await mcpServer.connect(transport);

  const shutdown = async () => { await manager.close(); process.exit(0); };
  process.once('SIGINT',  () => { void shutdown(); });
  process.once('SIGTERM', () => { void shutdown(); });
}

main().catch((err: unknown) => {
  console.error('[r3f-mcp] Fatal error:', err instanceof Error ? err.message : err);
  process.exit(1);
});
