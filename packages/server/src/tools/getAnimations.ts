import { z } from 'zod';
import type { Tool } from '@modelcontextprotocol/sdk/types.js';
import type { WebSocketManager } from '../connection.js';
import { GetAnimationsInputSchema } from '../types.js';
import type { GetAnimationsInput } from '../types.js';

export const getAnimationsSchema = GetAnimationsInputSchema;
export type { GetAnimationsInput };

export const getAnimationsTool: Tool = {
  name: 'get_animations',
  description:
    'List all active animations in the scene. Returns clip name, target object, ' +
    'current progress, duration, loop state, and paused state. ' +
    'Detects THREE.AnimationMixer animations registered via useRegisterAnimation() ' +
    'or stored in object.userData.mixer.',
  inputSchema: {
    type: 'object',
    properties: {
      identifier: {
        type: 'string',
        description: 'Filter to animations on a specific object (name or UUID)',
      },
    },
    required: [],
  },
};

export async function handleGetAnimations(
  args: GetAnimationsInput,
  connection: WebSocketManager,
) {
  return connection.requestGetAnimations(args.identifier);
}
