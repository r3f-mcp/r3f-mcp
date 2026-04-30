import { z } from 'zod';
import type { Tool } from '@modelcontextprotocol/sdk/types.js';
import type { WebSocketManager } from '../connection.js';
import { RemoveObjectInputSchema } from '../types.js';
import type { RemoveObjectInput } from '../types.js';

export const removeObjectSchema = RemoveObjectInputSchema;
export type { RemoveObjectInput };

export const removeObjectTool: Tool = {
  name: 'remove_object',
  description:
    'Remove an object from the scene by name or UUID. ' +
    'Also removes and disposes all children. ' +
    'Protected objects (the scene root and cameras) cannot be removed.',
  inputSchema: {
    type: 'object',
    properties: {
      identifier: { type: 'string', description: 'Name or UUID of the object to remove' },
    },
    required: ['identifier'],
  },
};

export async function handleRemoveObject(
  args: RemoveObjectInput,
  connection: WebSocketManager,
): Promise<{ uuid: string; name: string }> {
  return connection.requestRemoveObject(args.identifier);
}
