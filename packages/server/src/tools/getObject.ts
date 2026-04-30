import { z } from 'zod';
import type { Tool } from '@modelcontextprotocol/sdk/types.js';
import type { WebSocketManager } from '../connection.js';
import type { SerializedNode } from '../types.js';

// ─── Schema ───────────────────────────────────────────────────────────────────

export const getObjectSchema = z.object({
  identifier: z
    .string()
    .describe('The UUID or name of the object to retrieve'),
});
export type GetObjectInput = z.infer<typeof getObjectSchema>;

// ─── Tool definition ──────────────────────────────────────────────────────────

export const getObjectTool: Tool = {
  name: 'get_object',
  description:
    'Get detailed properties of a specific object in the scene by name or UUID. ' +
    'Returns the full serialized node including geometry, material, transform, and children.',
  inputSchema: {
    type: 'object',
    properties: {
      identifier: {
        type: 'string',
        description: 'The UUID or name of the object to retrieve',
      },
    },
    required: ['identifier'],
  },
};

// ─── Handler ──────────────────────────────────────────────────────────────────

export async function handleGetObject(
  args: GetObjectInput,
  connection: WebSocketManager,
): Promise<SerializedNode> {
  const obj = await connection.requestObject(args.identifier);
  if (obj === null) {
    throw new Error(`Object not found: "${args.identifier}"`);
  }
  return obj;
}
