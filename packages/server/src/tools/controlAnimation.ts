import { z } from 'zod';
import type { Tool } from '@modelcontextprotocol/sdk/types.js';
import type { WebSocketManager } from '../connection.js';
import { ControlAnimationInputSchema } from '../types.js';
import type { ControlAnimationInput, AnimationControlResult } from '../types.js';

export const controlAnimationSchema = ControlAnimationInputSchema;
export type { ControlAnimationInput };

export const controlAnimationTool: Tool = {
  name: 'control_animation',
  description:
    'Play, pause, stop, or seek an animation on a scene object. ' +
    'The object must have an AnimationMixer registered via useRegisterAnimation() ' +
    'or stored in object.userData.mixer.',
  inputSchema: {
    type: 'object',
    properties: {
      target: { type: 'string', description: 'Name or UUID of the animated object' },
      action: {
        type: 'string',
        enum: ['play', 'pause', 'stop', 'seek'],
        description: 'Operation to perform',
      },
      time: {
        type: 'number',
        description: 'Seek target in seconds — required when action is "seek"',
      },
      animationName: {
        type: 'string',
        description: 'Clip name when the object has multiple animations',
      },
    },
    required: ['target', 'action'],
  },
};

export async function handleControlAnimation(
  args: ControlAnimationInput,
  connection: WebSocketManager,
): Promise<AnimationControlResult> {
  return connection.requestControlAnimation(
    args.target,
    args.action,
    args.time,
    args.animationName,
  );
}
