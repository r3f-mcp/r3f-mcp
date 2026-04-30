import { z } from 'zod';
import type { Tool } from '@modelcontextprotocol/sdk/types.js';
import type { WebSocketManager } from '../connection.js';
import { SceneDiffInputSchema } from '../types.js';
import type { SceneDiffInput, SerializedNode } from '../types.js';

export const sceneDiffSchema = SceneDiffInputSchema;
export type { SceneDiffInput };

export const sceneDiffTool: Tool = {
  name: 'scene_diff',
  description:
    'Compare the current scene to the last snapshot (taken by scene_graph or a previous scene_diff). ' +
    'Returns added objects, removed objects, modified properties, and an unchanged count. ' +
    'On the first call (no previous snapshot) the entire scene is reported as "added".',
  inputSchema: {
    type: 'object',
    properties: {},
    required: [],
  },
};

// ─── Diff types ───────────────────────────────────────────────────────────────

interface FlatNode {
  uuid:          string;
  name:          string;
  type:          string;
  position:      [number, number, number];
  rotation:      [number, number, number];
  scale:         [number, number, number];
  visible:       boolean;
  castShadow:    boolean;
  receiveShadow: boolean;
  // Material snapshot (first material if array)
  matColor?:     string;
  matOpacity?:   number;
  matWireframe?: boolean;
  // Light snapshot
  lightColor?:     string;
  lightIntensity?: number;
}

function flatten(
  node: SerializedNode,
  result: Map<string, FlatNode> = new Map(),
): Map<string, FlatNode> {
  const mat = Array.isArray(node.material) ? node.material[0] : node.material;
  result.set(node.uuid, {
    uuid:          node.uuid,
    name:          node.name,
    type:          node.type,
    position:      node.position,
    rotation:      node.rotation,
    scale:         node.scale,
    visible:       node.visible,
    castShadow:    node.castShadow,
    receiveShadow: node.receiveShadow,
    matColor:      mat?.color,
    matOpacity:    mat?.opacity,
    matWireframe:  mat?.wireframe,
    lightColor:    node.light?.color,
    lightIntensity:node.light?.intensity,
  });
  for (const child of node.children) flatten(child, result);
  return result;
}

// Approximate equality for floats (avoids false positives from fp rounding).
function approxEq(a: number, b: number): boolean {
  return Math.abs(a - b) < 1e-5;
}

function vec3Eq(
  a: [number, number, number],
  b: [number, number, number],
): boolean {
  return approxEq(a[0], b[0]) && approxEq(a[1], b[1]) && approxEq(a[2], b[2]);
}

type Changes = Record<string, { from: unknown; to: unknown }>;

function diffNode(prev: FlatNode, curr: FlatNode): Changes {
  const ch: Changes = {};

  if (curr.name !== prev.name)
    ch['name'] = { from: prev.name, to: curr.name };
  if (!vec3Eq(curr.position, prev.position))
    ch['position'] = { from: prev.position, to: curr.position };
  if (!vec3Eq(curr.rotation, prev.rotation))
    ch['rotation'] = { from: prev.rotation, to: curr.rotation };
  if (!vec3Eq(curr.scale, prev.scale))
    ch['scale'] = { from: prev.scale, to: curr.scale };
  if (curr.visible !== prev.visible)
    ch['visible'] = { from: prev.visible, to: curr.visible };
  if (curr.castShadow !== prev.castShadow)
    ch['castShadow'] = { from: prev.castShadow, to: curr.castShadow };
  if (curr.receiveShadow !== prev.receiveShadow)
    ch['receiveShadow'] = { from: prev.receiveShadow, to: curr.receiveShadow };

  // Material
  if (curr.matColor !== prev.matColor)
    ch['material.color'] = { from: prev.matColor, to: curr.matColor };
  if (curr.matOpacity !== undefined || prev.matOpacity !== undefined) {
    if (!approxEq(curr.matOpacity ?? 1, prev.matOpacity ?? 1))
      ch['material.opacity'] = { from: prev.matOpacity, to: curr.matOpacity };
  }
  if (curr.matWireframe !== prev.matWireframe)
    ch['material.wireframe'] = { from: prev.matWireframe, to: curr.matWireframe };

  // Light
  if (curr.lightColor !== prev.lightColor)
    ch['light.color'] = { from: prev.lightColor, to: curr.lightColor };
  if (curr.lightIntensity !== undefined || prev.lightIntensity !== undefined) {
    if (!approxEq(curr.lightIntensity ?? 1, prev.lightIntensity ?? 1))
      ch['light.intensity'] = { from: prev.lightIntensity, to: curr.lightIntensity };
  }

  return ch;
}

// ─── Handler ──────────────────────────────────────────────────────────────────

type DiffContent = {
  content: Array<{ type: 'text'; text: string }>;
};

export async function handleSceneDiff(
  _args: SceneDiffInput,
  connection: WebSocketManager,
): Promise<DiffContent> {
  const currentScene = await connection.requestSceneGraph();
  const timestamp    = new Date().toISOString();
  const previous     = connection.getLastSnapshot();

  // Always update the snapshot after diffing.
  connection.storeSnapshot(currentScene);

  const currentMap = flatten(currentScene);

  // ── First call: no prior snapshot ──────────────────────────────────────────
  if (!previous) {
    const added = [...currentMap.values()].map(n => ({
      uuid: n.uuid, name: n.name, type: n.type,
    }));
    return {
      content: [{
        type: 'text',
        text: JSON.stringify({
          added,
          removed:   [],
          modified:  [],
          unchanged: 0,
          timestamp,
          previousTimestamp: timestamp,
          note: 'First snapshot — entire scene reported as added.',
        }, null, 2),
      }],
    };
  }

  // ── Diff against stored snapshot ───────────────────────────────────────────
  const previousMap = flatten(previous.scene);

  const added: Array<{ uuid: string; name: string; type: string }> = [];
  const removed: Array<{ uuid: string; name: string; type: string }> = [];
  const modified: Array<{ uuid: string; name: string; changes: Changes }> = [];
  let unchanged = 0;

  for (const [uuid, curr] of currentMap) {
    const prev = previousMap.get(uuid);
    if (!prev) {
      added.push({ uuid: curr.uuid, name: curr.name, type: curr.type });
    } else {
      const changes = diffNode(prev, curr);
      if (Object.keys(changes).length > 0) {
        modified.push({ uuid: curr.uuid, name: curr.name, changes });
      } else {
        unchanged++;
      }
    }
  }

  for (const [uuid, prev] of previousMap) {
    if (!currentMap.has(uuid)) {
      removed.push({ uuid: prev.uuid, name: prev.name, type: prev.type });
    }
  }

  return {
    content: [{
      type: 'text',
      text: JSON.stringify({
        added,
        removed,
        modified,
        unchanged,
        timestamp,
        previousTimestamp: previous.timestamp,
      }, null, 2),
    }],
  };
}
