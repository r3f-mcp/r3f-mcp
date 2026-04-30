import { z } from 'zod';
import type { Tool } from '@modelcontextprotocol/sdk/types.js';
import type { WebSocketManager } from '../connection.js';
import { QueryBoundsInputSchema } from '../types.js';
import type { QueryBoundsInput, BoundsResult } from '../types.js';

export const queryBoundsSchema = QueryBoundsInputSchema;
export type { QueryBoundsInput };

export const queryBoundsTool: Tool = {
  name: 'query_bounds',
  description:
    'Get the axis-aligned bounding box (AABB) of an object or group in world coordinates. ' +
    'Returns min/max corners, center point, and size (width/height/depth).',
  inputSchema: {
    type: 'object',
    properties: {
      identifier: { type: 'string', description: 'Name or UUID of the object' },
    },
    required: ['identifier'],
  },
};

export async function handleQueryBounds(
  args: QueryBoundsInput,
  connection: WebSocketManager,
): Promise<BoundsResult> {
  return connection.requestQueryBounds(args.identifier);
}
