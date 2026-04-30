import { z } from 'zod';
import type { Tool } from '@modelcontextprotocol/sdk/types.js';
import type { WebSocketManager } from '../connection.js';
import { QueryDistanceInputSchema } from '../types.js';
import type { QueryDistanceInput, DistanceResult } from '../types.js';

export const queryDistanceSchema = QueryDistanceInputSchema;
export type { QueryDistanceInput };

export const queryDistanceTool: Tool = {
  name: 'query_distance',
  description:
    'Measure the world-space distance between two objects. ' +
    'Returns the scalar distance, the world position of each object, ' +
    'and the unit direction vector pointing from the first to the second.',
  inputSchema: {
    type: 'object',
    properties: {
      from: { type: 'string', description: 'Name or UUID of the first object' },
      to:   { type: 'string', description: 'Name or UUID of the second object' },
    },
    required: ['from', 'to'],
  },
};

export async function handleQueryDistance(
  args: QueryDistanceInput,
  connection: WebSocketManager,
): Promise<DistanceResult> {
  return connection.requestQueryDistance(args.from, args.to);
}
