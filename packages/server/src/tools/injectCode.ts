import { z } from 'zod';
import type { Tool } from '@modelcontextprotocol/sdk/types.js';
import type { WebSocketManager } from '../connection.js';
import { InjectCodeInputSchema } from '../types.js';
import type { InjectCodeInput } from '../types.js';

export const injectCodeSchema = InjectCodeInputSchema;
export type { InjectCodeInput };

export const injectCodeTool: Tool = {
  name: 'inject_code',
  description:
    'Inject R3F/Three.js component code into the running browser scene for immediate live preview. ' +
    'The code is evaluated in the browser — no file writing, no dev server restart. ' +
    'Errors are returned so you can self-correct. ' +
    'Available scope: React hooks (useState, useEffect, useRef, useMemo, useCallback), ' +
    'R3F hooks (useFrame, useThree), THREE (full namespace). ' +
    'Code must default-export a functional component.',
  inputSchema: {
    type: 'object',
    properties: {
      code: {
        type: 'string',
        description: 'Complete TSX component source. Must have a default export.',
      },
      name: {
        type: 'string',
        description: 'Identifier for this injection — used by commit_component and remove_injection',
      },
      replace: {
        type: 'string',
        description: 'Name of a previous injection to replace (enables iteration)',
      },
    },
    required: ['code'],
  },
};

// ─── Handler ──────────────────────────────────────────────────────────────────

type InjectContent = { content: Array<{ type: 'text'; text: string }> };

export async function handleInjectCode(
  args: InjectCodeInput,
  connection: WebSocketManager,
): Promise<InjectContent> {
  const name   = args.name ?? `injection_${Date.now()}`;
  const result = await connection.requestInjectCode(args.code, name, args.replace);

  const text = result.success
    ? `Injected "${result.name}" (UUID: ${result.uuid}). ` +
      `The component is now live in the running scene. ` +
      `Call commit_component with name="${result.name}" to save it to a file.`
    : `Injection failed — ${result.error ?? 'unknown error'}. ` +
      `Fix the code and call inject_code again with replace="${name}".`;

  return { content: [{ type: 'text', text }] };
}
