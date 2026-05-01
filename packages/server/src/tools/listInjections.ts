import { z } from 'zod';
import type { Tool } from '@modelcontextprotocol/sdk/types.js';
import type { WebSocketManager } from '../connection.js';
import { ListInjectionsInputSchema } from '../types.js';
import type { ListInjectionsInput } from '../types.js';

export const listInjectionsSchema = ListInjectionsInputSchema;
export type { ListInjectionsInput };

export const listInjectionsTool: Tool = {
  name: 'list_injections',
  description:
    'List all currently active live-preview components in the running scene. ' +
    'Shows their name, UUID, whether they have render errors, and when they were injected.',
  inputSchema: {
    type: 'object',
    properties: {},
    required: [],
  },
};

export async function handleListInjections(
  _args: ListInjectionsInput,
  connection: WebSocketManager,
) {
  const injections = await connection.requestListInjections();
  return injections;
}
