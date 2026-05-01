import { z } from 'zod';
import type { Tool } from '@modelcontextprotocol/sdk/types.js';
import type { WebSocketManager } from '../connection.js';
import { GenerateComponentInputSchema } from '../types.js';
import type { GenerateComponentInput, SerializedNode } from '../types.js';

export const generateComponentSchema = GenerateComponentInputSchema;
export type { GenerateComponentInput };

export const generateComponentTool: Tool = {
  name: 'generate_component',
  description:
    'Generate a React Three Fiber component from a natural language description. ' +
    'The tool fetches the current scene graph so the generated component can be ' +
    'positioned and styled to fit naturally into what already exists. ' +
    'After this tool runs, generate the component code yourself using the scene context ' +
    'below, then call inject_code with the result.',
  inputSchema: {
    type: 'object',
    properties: {
      description: {
        type: 'string',
        description: 'Natural language description of what to create',
      },
      name: {
        type: 'string',
        description: 'PascalCase component name, e.g. "FloatingCube"',
      },
      position: {
        type: 'array',
        items: { type: 'number' },
        minItems: 3,
        maxItems: 3,
        description: '[x, y, z] where to place it in the scene',
      },
      preview: {
        type: 'boolean',
        description: 'Whether to inject into the running scene immediately (default true)',
      },
    },
    required: ['description', 'name'],
  },
};

// ─── Summarize scene context ───────────────────────────────────────────────────

function summarizeScene(node: SerializedNode, depth = 0): string {
  const indent  = '  '.repeat(depth);
  const pos     = node.position.map(n => n.toFixed(2)).join(', ');
  const matColor = Array.isArray(node.material)
    ? node.material[0]?.color
    : node.material?.color;
  const colorNote = matColor ? ` color=${matColor}` : '';
  const lightNote = node.light
    ? ` light(${node.light.color} intensity=${node.light.intensity})`
    : '';
  let out = `${indent}• ${node.name} [${node.type}] pos=[${pos}]${colorNote}${lightNote}\n`;
  for (const child of node.children.slice(0, 20)) {
    out += summarizeScene(child, depth + 1);
  }
  return out;
}

// ─── Handler ──────────────────────────────────────────────────────────────────

type GenerateContent = { content: Array<{ type: 'text'; text: string }> };

export async function handleGenerateComponent(
  args: GenerateComponentInput,
  connection: WebSocketManager,
): Promise<GenerateContent> {
  const scene   = await connection.requestSceneGraph();
  const summary = summarizeScene(scene);
  const pos     = args.position ? JSON.stringify(args.position) : '[0, 0, 0]';

  const instructions = `
Generate a React Three Fiber component and inject it into the running scene.

═══ TASK ════════════════════════════════════════════════════════════════════════
Name:        ${args.name}
Position:    ${pos}
Description: ${args.description}

═══ CURRENT SCENE ═══════════════════════════════════════════════════════════════
${summary}
═════════════════════════════════════════════════════════════════════════════════

═══ COMPONENT REQUIREMENTS ══════════════════════════════════════════════════════
• Self-contained functional component with TypeScript
• Default export only — no named exports
• Allowed imports: react (hooks), @react-three/fiber (useFrame, useThree),
  three (as THREE). Do NOT import from @react-three/drei or any other package.
• No required props — use sensible defaults
• Position the component at ${pos} in the scene
• Fit the visual style of the existing scene
• When done, call inject_code with:
    - code: the complete component source
    - name: "${args.name}"
    ${args.preview ? '(preview: true is default)' : ''}

Example component shape:
\`\`\`tsx
export default function ${args.name}() {
  const ref = useRef<THREE.Mesh>(null);
  useFrame((_, delta) => {
    if (ref.current) ref.current.rotation.y += delta;
  });
  return (
    <mesh ref={ref} position={${pos}}>
      <boxGeometry args={[1, 1, 1]} />
      <meshStandardMaterial color="#888" metalness={0.8} roughness={0.2} />
    </mesh>
  );
}
\`\`\`

Now generate the ${args.name} component and inject it.
`.trim();

  return { content: [{ type: 'text', text: instructions }] };
}
