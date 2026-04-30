import { z } from 'zod';
import type { Tool } from '@modelcontextprotocol/sdk/types.js';
import type { WebSocketManager } from '../connection.js';

// ─── Schema ───────────────────────────────────────────────────────────────────

const Vec3 = z.tuple([z.number(), z.number(), z.number()]);

export const setTransformSchema = z
  .object({
    identifier: z
      .string()
      .describe('The UUID or name of the object to move'),
    position: Vec3.optional().describe(
      '[x, y, z] world-space position',
    ),
    rotation: Vec3.optional().describe(
      '[x, y, z] Euler rotation in radians (XYZ order)',
    ),
    scale: Vec3.optional().describe(
      '[x, y, z] scale factors — use [1, 1, 1] for default size',
    ),
  })
  .refine(
    (d) =>
      d.position !== undefined ||
      d.rotation !== undefined ||
      d.scale !== undefined,
    { message: 'At least one of position, rotation, or scale must be provided' },
  );

export type SetTransformInput = z.infer<typeof setTransformSchema>;

// ─── Tool definition ──────────────────────────────────────────────────────────

export const setTransformTool: Tool = {
  name: 'set_transform',
  description:
    'Update the position, rotation, or scale of an object in the scene. ' +
    'Changes are applied immediately and visually reflected in the running application. ' +
    'Provide at least one of position, rotation, or scale.',
  inputSchema: {
    type: 'object',
    properties: {
      identifier: {
        type: 'string',
        description: 'The UUID or name of the object to move',
      },
      position: {
        type: 'array',
        items: { type: 'number' },
        minItems: 3,
        maxItems: 3,
        description: '[x, y, z] world-space position',
      },
      rotation: {
        type: 'array',
        items: { type: 'number' },
        minItems: 3,
        maxItems: 3,
        description: '[x, y, z] Euler rotation in radians (XYZ order)',
      },
      scale: {
        type: 'array',
        items: { type: 'number' },
        minItems: 3,
        maxItems: 3,
        description: '[x, y, z] scale factors — use [1, 1, 1] for default size',
      },
    },
    required: ['identifier'],
  },
};

// ─── Handler ──────────────────────────────────────────────────────────────────

export async function handleSetTransform(
  args: SetTransformInput,
  connection: WebSocketManager,
): Promise<boolean> {
  const { identifier, position, rotation, scale } = args;
  return connection.requestTransformEdit(identifier, { position, rotation, scale });
}
