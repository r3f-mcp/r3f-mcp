import { z } from 'zod';
import type { Tool } from '@modelcontextprotocol/sdk/types.js';
import type { WebSocketManager } from '../connection.js';
import { GetPerformanceProfileInputSchema } from '../types.js';
import type { GetPerformanceProfileInput, ProfileResult } from '../types.js';

export const getPerformanceProfileSchema = GetPerformanceProfileInputSchema;
export type { GetPerformanceProfileInput };

export const getPerformanceProfileTool: Tool = {
  name: 'get_performance_profile',
  description:
    'Profile the scene for a specified duration and return statistics: ' +
    'min/max/average/median/p99 FPS, draw call and triangle distribution, ' +
    'the 10 heaviest meshes by triangle count, and actionable recommendations ' +
    '(instancing, LOD, geometry merging). Default duration: 3 s, max: 30 s.',
  inputSchema: {
    type: 'object',
    properties: {
      duration: {
        type: 'number',
        minimum: 0.5,
        maximum: 30,
        description: 'Profiling duration in seconds (default 3)',
      },
    },
    required: [],
  },
};

type ProfileContent = { content: Array<{ type: 'text'; text: string }> };

export async function handleGetPerformanceProfile(
  args: GetPerformanceProfileInput,
  connection: WebSocketManager,
): Promise<ProfileContent> {
  const duration = args.duration ?? 3;
  const result   = await connection.requestGetPerformanceProfile(duration);
  return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
}
