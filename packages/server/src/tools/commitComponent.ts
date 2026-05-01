import { mkdirSync, writeFileSync } from 'fs';
import { join, basename } from 'path';
import { z } from 'zod';
import type { Tool } from '@modelcontextprotocol/sdk/types.js';
import type { WebSocketManager } from '../connection.js';
import { CommitComponentInputSchema } from '../types.js';
import type { CommitComponentInput } from '../types.js';

export const commitComponentSchema = CommitComponentInputSchema;
export type { CommitComponentInput };

export const commitComponentTool: Tool = {
  name: 'commit_component',
  description:
    'Save a live-injected preview component to an actual file in the user\'s project. ' +
    'The component must have been injected with inject_code first. ' +
    'Returns the file path, the import line, and a JSX usage snippet.',
  inputSchema: {
    type: 'object',
    properties: {
      name:      { type: 'string', description: 'Injection name to commit' },
      directory: { type: 'string', description: 'Directory to save to (default: "./src/components")' },
      filename:  { type: 'string', description: 'Override filename (default: {Name}.tsx)' },
    },
    required: ['name'],
  },
};

// ─── Handler ──────────────────────────────────────────────────────────────────

type CommitContent = { content: Array<{ type: 'text'; text: string }> };

export async function handleCommitComponent(
  args: CommitComponentInput,
  connection: WebSocketManager,
): Promise<CommitContent> {
  const entry = connection.getInjectionCode(args.name);
  if (!entry) {
    throw new Error(
      `No injection named "${args.name}" found. ` +
      `Available injections: ${[...connection.getInjectionRegistry().keys()].join(', ') || '(none)'}`,
    );
  }

  const dir      = args.directory ?? './src/components';
  const filename = args.filename  ?? `${args.name}.tsx`;
  const filePath = join(dir, filename);
  const stem     = basename(filename, '.tsx');

  mkdirSync(dir, { recursive: true });
  writeFileSync(filePath, entry.code, 'utf8');

  const importLine = `import ${args.name} from '${dir.replace(/^\.\//, '')}/'\`${stem}\`'`;
  const usage      = `<${args.name} />`;

  const text =
    `✓ Saved to ${filePath}\n\n` +
    `Import:  import ${args.name} from './${join(dir, stem).replace(/\\/g, '/')}'\n` +
    `Usage:   ${usage}`;

  return { content: [{ type: 'text', text }] };
}
