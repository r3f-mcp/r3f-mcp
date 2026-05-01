import { mkdirSync, writeFileSync, accessSync, existsSync, statSync, constants } from 'fs';
import { join, resolve, dirname, basename } from 'path';
import { homedir } from 'os';
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
    'IMPORTANT WORKFLOW: Generate all component code FIRST, then pass it in the ' +
    '"components" array so everything is written in a single tool call. ' +
    'Do NOT call this tool and then try to write the same files again — ' +
    'all files are written to the user\'s local filesystem and exist immediately.',
  inputSchema: {
    type: 'object',
    properties: {
      description: { type: 'string', description: 'What to build, e.g. "a space shooter game"' },
      directory:   { type: 'string', description: 'Where to create the project (supports ~/...)' },
      template: {
        type: 'string',
        enum: ['game', 'showcase', 'portfolio', 'visualization', 'experience'],
        description: 'Project archetype',
      },
      features: {
        type: 'array', items: { type: 'string' },
        description: 'e.g. ["physics","postprocessing"]',
      },
      components: {
        type: 'array',
        description:
          'Pre-generated component files. Generate ALL component code before calling this tool ' +
          'so the entire project is written in one call.',
        items: {
          type: 'object',
          properties: {
            name:        { type: 'string', description: 'PascalCase component name' },
            description: { type: 'string', description: 'What this component does' },
            code:        { type: 'string', description: 'Complete TSX source (default-exported function)' },
          },
          required: ['name', 'code'],
        },
      },
    },
    required: ['description', 'directory'],
  },
};

// ─── Path resolution ──────────────────────────────────────────────────────────

function resolveDir(raw: string): string {
  const expanded = raw.startsWith('~') ? join(homedir(), raw.slice(1)) : raw;
  return resolve(expanded);
}

// ─── File size helper ─────────────────────────────────────────────────────────

function fmtSize(bytes: number): string {
  return bytes >= 1024 ? `${(bytes / 1024).toFixed(1)} KB` : `${bytes} B`;
}

// ─── File templates ───────────────────────────────────────────────────────────

function packageJson(name: string, features: string[]): string {
  const hasPhysics = features.includes('physics');
  const hasPost    = features.includes('postprocessing');
  return JSON.stringify({
    name, version: '0.1.0', private: true, type: 'module',
    scripts: { dev: 'vite', build: 'tsc && vite build', preview: 'vite preview' },
    dependencies: {
      '@react-three/drei': '^9.0.0',
      '@react-three/fiber': '^8.15.0',
      'r3f-mcp': '^0.4.0',
      'react': '^18.2.0', 'react-dom': '^18.2.0', 'three': '^0.160.0',
      ...(hasPhysics ? { '@react-three/rapier': '^1.0.0' } : {}),
      ...(hasPost    ? { '@react-three/postprocessing': '^2.14.0' } : {}),
    },
    devDependencies: {
      '@types/react': '^18.2.0', '@types/react-dom': '^18.2.0',
      '@types/three': '^0.160.0', '@vitejs/plugin-react': '^4.2.0',
      'typescript': '^5.4.0', 'vite': '^5.0.0',
    },
  }, null, 2);
}

const VITE_CONFIG = `import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({ plugins: [react()] });
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
    <style>body{margin:0;overflow:hidden}#root{width:100dvw;height:100dvh}</style>
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

function appTsx(
  description: string,
  hasPhysics: boolean,
  components: Array<{ name: string; description: string }> = [],
): string {
  const physicsImport = hasPhysics ? `import { Physics } from '@react-three/rapier';\n` : '';
  const physicsOpen   = hasPhysics ? '\n      <Physics>' : '';
  const physicsClose  = hasPhysics ? '\n      </Physics>' : '';

  const compImports = components.length
    ? '\n' + components.map(c => `import ${c.name} from './components/${c.name}';`).join('\n')
    : '';

  const compUsage = components.length
    ? components.map(c => `      <${c.name} /> {/* ${c.description} */}`).join('\n')
    : `      {/* Components will appear here — use inject_code or add to src/components/ */}`;

  return `import { Canvas } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import { MCPProvider } from 'r3f-mcp';
${physicsImport}${compImports}

// ${description}

function Scene() {
  return (
    <MCPProvider port={3333}>
      <ambientLight intensity={0.5} />
      <directionalLight position={[5, 10, 5]} intensity={1} castShadow />${physicsOpen}
${compUsage}${physicsClose}
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
    <Canvas shadows camera={{ position: [5, 5, 8], fov: 50 }} gl={{ preserveDrawingBuffer: true }}>
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
  // ── 1. Resolve absolute path, expand ~ ────────────────────────────────────
  const dir      = resolveDir(args.directory);
  const slug     = basename(dir) || 'r3f-app';
  const features = args.features  ?? [];
  const components = args.components ?? [];
  const hasPhysics = features.includes('physics');

  // ── 2. Permission check on parent ─────────────────────────────────────────
  const parentDir = dirname(dir);
  try {
    accessSync(parentDir, constants.W_OK);
  } catch {
    throw new Error(
      `Cannot write to "${parentDir}" — check the path exists and is writable.`,
    );
  }

  // ── 3. Create directory tree ───────────────────────────────────────────────
  try {
    mkdirSync(join(dir, 'src', 'components'), { recursive: true });
  } catch (err) {
    throw new Error(
      `Failed to create "${dir}": ${err instanceof Error ? err.message : String(err)}`,
    );
  }

  // ── 4. Build file list (boilerplate + user components) ────────────────────
  const files: Array<{ relPath: string; content: string }> = [
    { relPath: 'package.json',   content: packageJson(slug, features) },
    { relPath: 'vite.config.ts', content: VITE_CONFIG },
    { relPath: 'tsconfig.json',  content: TSCONFIG },
    { relPath: 'index.html',     content: INDEX_HTML },
    { relPath: 'src/main.tsx',   content: MAIN_TSX },
    { relPath: 'src/App.tsx',    content: appTsx(args.description, hasPhysics, components) },
    ...components.map(c => ({
      relPath: `src/components/${c.name}.tsx`,
      content: c.code,
    })),
  ];

  // ── 5. Write all files, collecting results ────────────────────────────────
  type FileResult = { relPath: string; absPath: string; size: number };
  const written: FileResult[] = [];
  const failed:  string[]     = [];

  for (const file of files) {
    const absPath = join(dir, file.relPath);
    try {
      mkdirSync(dirname(absPath), { recursive: true });
      writeFileSync(absPath, file.content, 'utf8');
      written.push({ relPath: file.relPath, absPath, size: statSync(absPath).size });
    } catch (err) {
      failed.push(`${file.relPath}: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  if (failed.length === files.length) {
    throw new Error(`All writes failed:\n` + failed.map(f => `  • ${f}`).join('\n'));
  }

  // ── 6. Verify key files exist and record sizes ────────────────────────────
  const keyPaths = ['package.json', 'src/App.tsx'];
  const verification = keyPaths.map(p => {
    const abs = join(dir, p);
    if (!existsSync(abs)) return `  ✗ ${abs} — MISSING`;
    const size = statSync(abs).size;
    return `  ✓ ${abs} (${fmtSize(size)})`;
  }).join('\n');

  // ── 7. Build response ─────────────────────────────────────────────────────
  const fileList = written
    .map(f => `  ${f.relPath} (${fmtSize(f.size)})`)
    .join('\n');

  const failNote = failed.length
    ? `\n⚠️  ${failed.length} file(s) could not be written:\n${failed.map(f => `  • ${f}`).join('\n')}\n`
    : '';

  const text = [
    `✅ Project successfully created on the user's local machine.`,
    ``,
    `Directory: ${dir}`,
    `Files created: ${written.length}`,
    ``,
    fileList,
    failNote,
    `Verified on disk:`,
    verification,
    ``,
    `To run the project, the user should open their terminal and run:`,
    `  cd ${dir}`,
    `  npm install`,
    `  npm run dev`,
    ``,
    `IMPORTANT: All files have been written directly to the user's local filesystem.`,
    `Do NOT attempt to recreate, rewrite, or present these files in chat.`,
    `They already exist at the paths listed above.`,
    `Your next step should be to tell the user to run:`,
    `  cd ${dir} && npm install && npm run dev`,
    `— nothing else is needed.`,
  ].join('\n');

  return { content: [{ type: 'text', text }] };
}
