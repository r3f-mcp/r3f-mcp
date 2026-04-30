import { writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { z } from 'zod';
import type { Tool } from '@modelcontextprotocol/sdk/types.js';
import type { WebSocketManager } from '../connection.js';

// ─── Schema ───────────────────────────────────────────────────────────────────

export const screenshotSchema = z.object({
  width: z
    .number()
    .int()
    .positive()
    .optional()
    .describe('Output image width in pixels (defaults to renderer canvas width)'),
  height: z
    .number()
    .int()
    .positive()
    .optional()
    .describe('Output image height in pixels (defaults to renderer canvas height)'),
});
export type ScreenshotInput = z.infer<typeof screenshotSchema>;

// ─── Tool definition ──────────────────────────────────────────────────────────

export const screenshotTool: Tool = {
  name: 'screenshot',
  description:
    'Capture a screenshot of the current rendered frame as a PNG image. ' +
    'The image is returned inline for Claude to view AND saved to a temp file ' +
    'whose path is included in the response. ' +
    'The canvas must have been created with preserveDrawingBuffer: true in <Canvas gl={...}> ' +
    'for this to work reliably across all browsers.',
  inputSchema: {
    type: 'object',
    properties: {
      width: {
        type: 'integer',
        minimum: 1,
        description:
          'Output image width in pixels (defaults to renderer canvas width)',
      },
      height: {
        type: 'integer',
        minimum: 1,
        description:
          'Output image height in pixels (defaults to renderer canvas height)',
      },
    },
    required: [],
  },
};

// ─── Handler ──────────────────────────────────────────────────────────────────

type ScreenshotContent = {
  content: Array<
    | { type: 'image'; data: string; mimeType: 'image/png' }
    | { type: 'text';  text: string }
  >;
};

export async function handleScreenshot(
  args: ScreenshotInput,
  connection: WebSocketManager,
): Promise<ScreenshotContent> {
  const raw = await connection.requestScreenshot(args.width, args.height);

  // Strip the data-URL prefix defensively in case the browser sends one.
  const base64 = raw.startsWith('data:') ? raw.slice(raw.indexOf(',') + 1) : raw;

  // Save to a temp file so Claude can reference the image by path.
  const filePath = join(tmpdir(), `r3f-screenshot-${Date.now()}.png`);
  writeFileSync(filePath, Buffer.from(base64, 'base64'));

  return {
    content: [
      {
        type: 'image',
        data: base64,
        mimeType: 'image/png',
      },
      {
        type: 'text',
        text: `Screenshot saved to ${filePath}`,
      },
    ],
  };
}
