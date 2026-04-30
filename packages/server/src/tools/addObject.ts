import { z } from 'zod';
import type { Tool } from '@modelcontextprotocol/sdk/types.js';
import type { WebSocketManager } from '../connection.js';
import { AddObjectInputSchema } from '../types.js';
import type { AddObjectInput } from '../types.js';

// ─── Schema (re-exported from types for index.ts) ────────────────────────────

export const addObjectSchema = AddObjectInputSchema;
export type { AddObjectInput };

// ─── Tool definition ──────────────────────────────────────────────────────────

export const addObjectTool: Tool = {
  name: 'add_object',
  description:
    'Add a new object to the running R3F scene. Supports meshes with standard ' +
    'geometries, lights, and groups. Changes appear immediately in the browser. ' +
    'The host React app is notified via onEdit so it can optionally sync state.',
  inputSchema: {
    type: 'object',
    properties: {
      name: { type: 'string', description: 'Name for the new object' },
      type: {
        type: 'string',
        enum: ['mesh', 'group', 'directionalLight', 'pointLight', 'spotLight', 'ambientLight'],
        description: 'Type of object to create',
      },
      position: {
        type: 'array', items: { type: 'number' }, minItems: 3, maxItems: 3,
        description: '[x, y, z] world-space position (default [0,0,0])',
      },
      rotation: {
        type: 'array', items: { type: 'number' }, minItems: 3, maxItems: 3,
        description: '[x, y, z] Euler rotation in radians (default [0,0,0])',
      },
      scale: {
        type: 'array', items: { type: 'number' }, minItems: 3, maxItems: 3,
        description: '[x, y, z] scale factors (default [1,1,1])',
      },
      parent: { type: 'string', description: 'Name or UUID of parent (default: scene root)' },
      geometry: {
        type: 'object',
        description: 'Geometry spec — for type "mesh"',
        properties: {
          type: {
            type: 'string',
            enum: ['box','sphere','cylinder','cone','torus','plane',
              'torusKnot','icosahedron','octahedron','ring','dodecahedron'],
          },
          args: { type: 'array', items: { type: 'number' },
            description: 'Geometry constructor args (e.g. [1,1,1] for box w/h/d, [0.5,32,32] for sphere r/wSeg/hSeg)' },
        },
      },
      material: {
        type: 'object',
        description: 'Material spec — for type "mesh"',
        properties: {
          type: { type: 'string', enum: ['standard','basic','phong','lambert','physical'] },
          color:       { type: 'string', description: "Hex/CSS color, e.g. '#ff0000'" },
          opacity:     { type: 'number', minimum: 0, maximum: 1 },
          transparent: { type: 'boolean' },
          metalness:   { type: 'number', minimum: 0, maximum: 1 },
          roughness:   { type: 'number', minimum: 0, maximum: 1 },
          wireframe:   { type: 'boolean' },
          side:        { type: 'string', enum: ['front','back','double'] },
        },
      },
      color:      { type: 'string', description: 'Light color as hex/CSS (light types only)' },
      intensity:  { type: 'number', description: 'Light intensity (light types only)' },
      distance:   { type: 'number', description: 'Light range — pointLight / spotLight' },
      angle:      { type: 'number', description: 'SpotLight cone angle in radians' },
      penumbra:   { type: 'number', minimum: 0, maximum: 1, description: 'SpotLight penumbra 0–1' },
      castShadow: { type: 'boolean', description: 'Whether this object casts shadows' },
    },
    required: ['name', 'type'],
  },
};

// ─── Handler ──────────────────────────────────────────────────────────────────

export async function handleAddObject(
  args: AddObjectInput,
  connection: WebSocketManager,
): Promise<{ uuid: string; name: string }> {
  return connection.requestAddObject(args);
}
