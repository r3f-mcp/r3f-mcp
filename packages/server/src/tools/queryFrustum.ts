import { z } from 'zod';
import type { Tool } from '@modelcontextprotocol/sdk/types.js';
import type { WebSocketManager } from '../connection.js';
import { QueryFrustumInputSchema } from '../types.js';
import type { QueryFrustumInput, FrustumResult } from '../types.js';

export const queryFrustumSchema = QueryFrustumInputSchema;
export type { QueryFrustumInput };

export const queryFrustumTool: Tool = {
  name: 'query_frustum',
  description:
    'List all objects currently visible within the camera\'s view frustum. ' +
    'Hidden objects (visible=false) are excluded. ' +
    'Returns each visible object with its name, UUID, type, and world position.',
  inputSchema: {
    type: 'object',
    properties: {
      camera: {
        type: 'string',
        description: 'Name or UUID of the camera to use (default: the scene active camera)',
      },
    },
    required: [],
  },
};

export async function handleQueryFrustum(
  args: QueryFrustumInput,
  connection: WebSocketManager,
): Promise<FrustumResult> {
  return connection.requestQueryFrustum(args.camera);
}
