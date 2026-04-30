import { z } from 'zod';
import type { Tool } from '@modelcontextprotocol/sdk/types.js';
import type { WebSocketManager } from '../connection.js';

// ─── Schema ───────────────────────────────────────────────────────────────────

export const setMaterialSchema = z.object({
  identifier: z
    .string()
    .describe('The UUID or name of the mesh whose material to update'),
  color: z
    .string()
    .optional()
    .describe("CSS color or hex value, e.g. '#ff8800' or 'orange' or 'hsl(30,100%,50%)'"),
  opacity: z
    .number()
    .min(0)
    .max(1)
    .optional()
    .describe('Opacity from 0 (invisible) to 1 (fully opaque)'),
  transparent: z
    .boolean()
    .optional()
    .describe('Enable transparency blending — required for opacity < 1 to take effect'),
  metalness: z
    .number()
    .min(0)
    .max(1)
    .optional()
    .describe('PBR metalness from 0 (dielectric) to 1 (metal)'),
  roughness: z
    .number()
    .min(0)
    .max(1)
    .optional()
    .describe('PBR roughness from 0 (mirror) to 1 (fully diffuse)'),
  wireframe: z.boolean().optional().describe('Render geometry as wireframe'),
  emissive: z
    .string()
    .optional()
    .describe('Emissive (glow) color — a CSS/hex string'),
  emissiveIntensity: z
    .number()
    .min(0)
    .optional()
    .describe('Strength of the emissive glow (default 1)'),
});
export type SetMaterialInput = z.infer<typeof setMaterialSchema>;

// ─── Tool definition ──────────────────────────────────────────────────────────

export const setMaterialTool: Tool = {
  name: 'set_material',
  description:
    'Update material properties of a mesh in the scene. ' +
    'Changes are applied immediately. ' +
    'Works on MeshStandardMaterial (metalness/roughness) and MeshBasicMaterial (color only). ' +
    'Setting opacity < 1 also requires transparent: true.',
  inputSchema: {
    type: 'object',
    properties: {
      identifier: {
        type: 'string',
        description: 'The UUID or name of the mesh whose material to update',
      },
      color: {
        type: 'string',
        description: "CSS color or hex value, e.g. '#ff8800' or 'orange'",
      },
      opacity: {
        type: 'number',
        minimum: 0,
        maximum: 1,
        description: 'Opacity from 0 (invisible) to 1 (fully opaque)',
      },
      transparent: {
        type: 'boolean',
        description: 'Enable transparency blending — required for opacity < 1 to take effect',
      },
      metalness: {
        type: 'number',
        minimum: 0,
        maximum: 1,
        description: 'PBR metalness from 0 (dielectric) to 1 (metal)',
      },
      roughness: {
        type: 'number',
        minimum: 0,
        maximum: 1,
        description: 'PBR roughness from 0 (mirror) to 1 (fully diffuse)',
      },
      wireframe: {
        type: 'boolean',
        description: 'Render geometry as wireframe',
      },
      emissive: {
        type: 'string',
        description: 'Emissive (glow) color — a CSS/hex string',
      },
      emissiveIntensity: {
        type: 'number',
        minimum: 0,
        description: 'Strength of the emissive glow (default 1)',
      },
    },
    required: ['identifier'],
  },
};

// ─── Handler ──────────────────────────────────────────────────────────────────

export async function handleSetMaterial(
  args: SetMaterialInput,
  connection: WebSocketManager,
): Promise<boolean> {
  const { identifier, ...properties } = args;
  return connection.requestMaterialEdit(identifier, properties);
}
