import { z } from 'zod';
import type { Tool } from '@modelcontextprotocol/sdk/types.js';
import type { WebSocketManager } from '../connection.js';
import { GetPhysicsInputSchema } from '../types.js';
import type { GetPhysicsInput, PhysicsResult } from '../types.js';

export const getPhysicsSchema = GetPhysicsInputSchema;
export type { GetPhysicsInput };

export const getPhysicsTool: Tool = {
  name: 'get_physics',
  description:
    'Read the Rapier physics world state: rigid bodies, colliders, joints, velocities, ' +
    'and sleep state. Requires @react-three/rapier and useRegisterPhysics(world) to be ' +
    'called inside your <Physics> provider. Returns { available: false } if physics is not set up.',
  inputSchema: {
    type: 'object',
    properties: {
      identifier: {
        type: 'string',
        description: 'Filter to bodies attached to a specific object (name or UUID)',
      },
    },
    required: [],
  },
};

export async function handleGetPhysics(
  args: GetPhysicsInput,
  connection: WebSocketManager,
): Promise<PhysicsResult> {
  return connection.requestGetPhysics(args.identifier);
}
