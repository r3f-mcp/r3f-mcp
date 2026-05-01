import { mkdirSync, writeFileSync, existsSync, statSync } from 'fs';
import { join, resolve, dirname, basename } from 'path';
import { homedir } from 'os';
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
    'IMPORTANT: After this tool runs, do NOT present the file contents in chat. ' +
    'The file has been written to disk — just tell the user the import line.',
  inputSchema: {
    type: 'object',
    properties: {
      name:      { type: 'string', description: 'Injection name to commit' },
      directory: { type: 'string', description: 'Directory to save to (default: "./src/components"). Supports ~/...' },
      filename:  { type: 'string', description: 'Override filename (default: {Name}.tsx)' },
    },
    required: ['name'],
  },
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function resolveDir(raw: string): string {
  const expanded = raw.startsWith('~') ? join(homedir(), raw.slice(1)) : raw;
  return resolve(expanded);
}

function fmtSize(bytes: number): string {
  return bytes >= 1024 ? `${(bytes / 1024).toFixed(1)} KB` : `${bytes} B`;
}

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
      `Available: ${[...connection.getInjectionRegistry().keys()].join(', ') || '(none)'}`,
    );
  }

  // Resolve to absolute path so the response is unambiguous
  const dir      = resolveDir(args.directory ?? './src/components');
  const filename = args.filename ?? `${args.name}.tsx`;
  const absPath  = join(dir, filename);
  const stem     = basename(filename, '.tsx');

  mkdirSync(dir, { recursive: true });
  writeFileSync(absPath, entry.code, 'utf8');

  // Verify it landed on disk
  const exists = existsSync(absPath);
  const size   = exists ? statSync(absPath).size : 0;
  const verification = exists
    ? `✓ ${absPath} (${fmtSize(size)})`
    : `✗ File not found after write — possible permission error`;

  // Derive a clean relative import path for the user
  const importPath = `./${dir.replace(/\\/g, '/').replace(/^\.\//, '')}/${stem}`;
  const importLine = `import ${args.name} from '${importPath}'`;

  const text = [
    `✅ File saved to the user's local machine.`,
    ``,
    `  ${verification}`,
    ``,
    `Import line:`,
    `  ${importLine}`,
    ``,
    `Usage:`,
    `  <${args.name} />`,
    ``,
    `IMPORTANT: This file has been written directly to the user's local filesystem`,
    `at ${absPath}. Do NOT present this file in chat or attempt to rewrite it.`,
    `It already exists. Tell the user the file has been saved and provide the import line.`,
  ].join('\n');

  return { content: [{ type: 'text', text }] };
}
