import { z } from 'zod';
import type { Tool } from '@modelcontextprotocol/sdk/types.js';
import type { WebSocketManager } from '../connection.js';

// ─── Schema ───────────────────────────────────────────────────────────────────

export const setVisibleSchema = z.object({
  identifier: z
    .string()
    .describe('The UUID or name of the object to show or hide'),
  visible: z.boolean().describe('true to show the object, false to hide it'),
});
export type SetVisibleInput = z.infer<typeof setVisibleSchema>;

// ─── Tool definition ──────────────────────────────────────────────────────────

export const setVisibleTool: Tool = {
  name: 'set_visible',
  description:
    'Show or hide an object in the scene. ' +
    'Hidden objects remain in the scene graph and can be shown again. ' +
    'Visibility propagates to all children.',
  inputSchema: {
    type: 'object',
    properties: {
      identifier: {
        type: 'string',
        description: 'The UUID or name of the object to show or hide',
      },
      visible: {
        type: 'boolean',
        description: 'true to show the object, false to hide it',
      },
    },
    required: ['identifier', 'visible'],
  },
};

// ─── Handler ──────────────────────────────────────────────────────────────────

export async function handleSetVisible(
  args: SetVisibleInput,
  connection: WebSocketManager,
): Promise<boolean> {
  return connection.requestVisibilityEdit(args.identifier, args.visible);
}
