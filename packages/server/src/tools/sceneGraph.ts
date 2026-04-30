import { z } from 'zod';
import type { Tool } from '@modelcontextprotocol/sdk/types.js';
import type { WebSocketManager } from '../connection.js';
import type { SerializedNode } from '../types.js';

// ─── Schema ───────────────────────────────────────────────────────────────────

export const sceneGraphSchema = z.object({});
export type SceneGraphInput = z.infer<typeof sceneGraphSchema>;

// ─── Tool definition ──────────────────────────────────────────────────────────

export const sceneGraphTool: Tool = {
  name: 'scene_graph',
  description:
    'Get the complete scene graph of the running R3F application. ' +
    'Returns every object with its transform, geometry, material, and children. ' +
    'Use this first to understand the scene structure before making targeted edits. ' +
    'The result is also cached internally for use by scene_diff.',
  inputSchema: {
    type: 'object',
    properties: {},
    required: [],
  },
};

// ─── Handler ──────────────────────────────────────────────────────────────────

export async function handleSceneGraph(
  _args: SceneGraphInput,
  connection: WebSocketManager,
): Promise<SerializedNode> {
  const scene = await connection.requestSceneGraph();
  // Store snapshot so scene_diff can compare against it on the next call.
  connection.storeSnapshot(scene);
  return scene;
}
