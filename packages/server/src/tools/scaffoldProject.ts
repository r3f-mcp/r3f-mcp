import { mkdirSync, writeFileSync, accessSync, constants } from 'fs';
import { join, resolve, dirname, basename } from 'path';
import { homedir } from 'os';
import { z } from 'zod';
import type { Tool } from '@modelcontextprotocol/sdk/types.js';
import type { WebSocketManager } from '../connection.js';
import { ScaffoldProjectInputSchema } from '../types.js';
import type { ScaffoldProjectInput } from '../types.js';

export const scaffoldProjectSchema = ScaffoldProjectInputSchema;
export type { ScaffoldProjectInput };

export const scaffoldProjectTool: Tool = {
  name: 'scaffold_project',
  description:
    'Create an entire new R3F project from a natural language description. ' +
    'Generates a complete, runnable project with package.json, vite config, ' +
    'TypeScript config, and a scene set up for AI iteration via MCPProvider. ' +
    'After scaffolding, use generate_component and inject_code to populate the scene.',
  inputSchema: {
    type: 'object',
    properties: {
      description: { type: 'string', description: 'What to build, e.g. "a space shooter game"' },
      directory:   { type: 'string', description: 'Where to create the project. Supports ~ for home directory.' },
      template: {
        type: 'string',
        enum: ['game', 'showcase', 'portfolio', 'visualization', 'experience'],
        description: 'Project archetype (helps guide the scaffolding)',
      },
      features: {
        type: 'array',
        items: { type: 'string' },
        description: 'Specific features e.g. ["physics","postprocessing","sound"]',
      },
    },
    required: ['description', 'directory'],
  },
};

// ─── Path resolution ──────────────────────────────────────────────────────────

/**
 * Resolve a directory path:
 *   - Expands leading `~` to the OS home directory (Node.js doesn't do this)
 *   - Converts relative paths to absolute using process.cwd()
 */
function resolveDir(raw: string): string {
  const expanded = raw.startsWith('~')
    ? join(homedir(), raw.slice(1))   // ~/foo → /Users/x/foo
    : raw;
  return resolve(expanded);           // ./foo  → /abs/path/foo
}

// ─── File templates ───────────────────────────────────────────────────────────

function packageJson(name: string, features: string[]): string {
  const hasPhysics = features.includes('physics');
  const hasPost    = features.includes('postprocessing');
  return JSON.stringify({
    name,
    version: '0.1.0',
    private: true,
    type: 'module',
    scripts: { dev: 'vite', build: 'tsc && vite build', preview: 'vite preview' },
    dependencies: {
      '@react-three/drei': '^9.0.0',
      '@react-three/fiber': '^8.15.0',
      'r3f-mcp': '^0.4.0',
      'react': '^18.2.0',
      'react-dom': '^18.2.0',
      'three': '^0.160.0',
      ...(hasPhysics ? { '@react-three/rapier': '^1.0.0' } : {}),
      ...(hasPost    ? { '@react-three/postprocessing': '^2.14.0' } : {}),
    },
    devDependencies: {
      '@types/react': '^18.2.0',
      '@types/react-dom': '^18.2.0',
      '@types/three': '^0.160.0',
      '@vitejs/plugin-react': '^4.2.0',
      'typescript': '^5.4.0',
      'vite': '^5.0.0',
    },
  }, null, 2);
}

const VITE_CONFIG = `import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
});
`;

const TSCONFIG = JSON.stringify({
  compilerOptions: {
    target: 'ES2020', module: 'ESNext', moduleResolution: 'bundler',
    jsx: 'react-jsx', strict: true, skipLibCheck: true,
    lib: ['ES2020', 'DOM'], noEmit: true,
  },
  include: ['src'],
}, null, 2);

const INDEX_HTML = `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>R3F App</title>
    <style>body { margin: 0; overflow: hidden; } #root { width: 100dvw; height: 100dvh; }</style>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
`;

const MAIN_TSX = `import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';

createRoot(document.getElementById('root')!).render(
  <StrictMode><App /></StrictMode>,
);
`;

function appTsx(description: string, hasPhysics: boolean): string {
  const physicsImport = hasPhysics ? `import { Physics } from '@react-three/rapier';\n` : '';
  const physicsWrap   = hasPhysics ? '<Physics>\n      ' : '';
  const physicsClose  = hasPhysics ? '\n      </Physics>' : '';

  return `import { Canvas } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import { MCPProvider } from 'r3f-mcp';
${physicsImport}
// ${description}
// Use generate_component and inject_code to build out this scene with AI.

function Scene() {
  return (
    <MCPProvider port={3333}>
      <ambientLight intensity={0.5} />
      <directionalLight position={[5, 10, 5]} intensity={1} castShadow />

      ${physicsWrap}{/* AI-generated components will appear here */}${physicsClose}

      <mesh name="Ground" rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[20, 20]} />
        <meshStandardMaterial color="#e2e8f0" />
      </mesh>

      <OrbitControls makeDefault />
    </MCPProvider>
  );
}

export function App() {
  return (
    <Canvas
      shadows
      camera={{ position: [5, 5, 8], fov: 50 }}
      gl={{ preserveDrawingBuffer: true }}
    >
      <Scene />
    </Canvas>
  );
}
`;
}

// ─── Handler ──────────────────────────────────────────────────────────────────

type ScaffoldContent = { content: Array<{ type: 'text'; text: string }> };

export async function handleScaffoldProject(
  args: ScaffoldProjectInput,
  _connection: WebSocketManager,
): Promise<ScaffoldContent> {
  // ── 1. Resolve the target directory to an absolute path ───────────────────
  const dir = resolveDir(args.directory);
  const slug = basename(dir) || 'r3f-app';

  const features   = args.features ?? [];
  const hasPhysics = features.includes('physics');

  // ── 2. Check write access to the parent directory before doing anything ───
  const parentDir = dirname(dir);
  try {
    accessSync(parentDir, constants.W_OK);
  } catch {
    throw new Error(
      `Cannot write to parent directory "${parentDir}". ` +
      `Check that the path exists and you have write permission.`,
    );
  }

  // ── 3. Create project root + src/ (recursive so intermediate dirs are made)
  try {
    mkdirSync(join(dir, 'src'), { recursive: true });
  } catch (err) {
    throw new Error(
      `Failed to create project directory "${dir}": ` +
      (err instanceof Error ? err.message : String(err)),
    );
  }

  // ── 4. Define files ────────────────────────────────────────────────────────
  const files: Array<{ path: string; content: string; description: string }> = [
    { path: 'package.json',   content: packageJson(slug, features), description: 'npm package manifest with all dependencies' },
    { path: 'vite.config.ts', content: VITE_CONFIG,                 description: 'Vite dev server configuration' },
    { path: 'tsconfig.json',  content: TSCONFIG,                    description: 'TypeScript configuration' },
    { path: 'index.html',     content: INDEX_HTML,                  description: 'HTML entry point' },
    { path: 'src/main.tsx',   content: MAIN_TSX,                    description: 'React root' },
    { path: 'src/App.tsx',    content: appTsx(args.description, hasPhysics), description: 'Main app with Canvas + MCPProvider' },
  ];

  // ── 5. Write files, collecting any errors ─────────────────────────────────
  const written: string[]  = [];
  const failed:  string[]  = [];

  for (const file of files) {
    const absPath = join(dir, file.path);
    // Ensure the file's parent directory exists (handles nested paths like src/)
    try {
      mkdirSync(dirname(absPath), { recursive: true });
      writeFileSync(absPath, file.content, 'utf8');
      written.push(file.path);
    } catch (err) {
      failed.push(
        `${file.path}: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }

  // ── 6. Report results ──────────────────────────────────────────────────────
  if (failed.length === files.length) {
    throw new Error(
      `All file writes failed for "${dir}":\n` + failed.map(f => `  • ${f}`).join('\n'),
    );
  }

  const fileList = files.map(f => `  • ${f.path} — ${f.description}`).join('\n');
  const failNote = failed.length
    ? `\n⚠️  ${failed.length} file(s) failed to write:\n${failed.map(f => `  • ${f}`).join('\n')}\n`
    : '';

  const instructions =
    `Project scaffolded at ${dir}\n\n` +
    `Files created (${written.length}/${files.length}):\n${fileList}\n` +
    failNote +
    `\nNext steps:\n` +
    `  cd ${dir}\n` +
    `  npm install\n` +
    `  npm run dev\n\n` +
    `Then start the MCP server in a separate terminal:\n` +
    `  npx r3f-mcp-server --port 3333\n\n` +
    `Now use generate_component to populate the scene:\n` +
    `  "Add a ${args.description.split(' ').slice(0, 5).join(' ')} component to the scene"`;

  return { content: [{ type: 'text', text: instructions }] };
}
