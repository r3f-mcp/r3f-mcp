import { z } from 'zod';
import type { Tool } from '@modelcontextprotocol/sdk/types.js';
import type { WebSocketManager } from '../connection.js';
import { GetPerformanceInputSchema } from '../types.js';
import type { GetPerformanceInput, PerformanceResult } from '../types.js';

export const getPerformanceSchema = GetPerformanceInputSchema;
export type { GetPerformanceInput };

export const getPerformanceTool: Tool = {
  name: 'get_performance',
  description:
    'Get real-time performance metrics: FPS (averaged over last 60 frames), draw calls, ' +
    'triangle count, geometries, textures, shader programs, and per-type scene object counts. ' +
    'Metrics are sampled continuously via useFrame — no extra round-trip overhead.',
  inputSchema: {
    type: 'object',
    properties: {},
    required: [],
  },
};

export async function handleGetPerformance(
  _args: GetPerformanceInput,
  connection: WebSocketManager,
): Promise<PerformanceResult> {
  return connection.requestGetPerformance();
}
