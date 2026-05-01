import { z } from 'zod';
import type { Tool } from '@modelcontextprotocol/sdk/types.js';
import type { WebSocketManager } from '../connection.js';
import { RemoveInjectionInputSchema } from '../types.js';
import type { RemoveInjectionInput } from '../types.js';

export const removeInjectionSchema = RemoveInjectionInputSchema;
export type { RemoveInjectionInput };

export const removeInjectionTool: Tool = {
  name: 'remove_injection',
  description: 'Remove a live-preview component from the running scene.',
  inputSchema: {
    type: 'object',
    properties: {
      name: { type: 'string', description: 'Name of the injection to remove' },
    },
    required: ['name'],
  },
};

export async function handleRemoveInjection(
  args: RemoveInjectionInput,
  connection: WebSocketManager,
) {
  return connection.requestRemoveInjection(args.name);
}
