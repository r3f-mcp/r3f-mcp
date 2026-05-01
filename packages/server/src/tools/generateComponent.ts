import { z } from 'zod';
import type { Tool } from '@modelcontextprotocol/sdk/types.js';
import type { WebSocketManager } from '../connection.js';
import { GenerateComponentInputSchema } from '../types.js';
import type { GenerateComponentInput, SerializedNode } from '../types.js';
import { determineEnvironment } from './sceneEnvironment.js';

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
  const env     = determineEnvironment(args.description);

  const instructions = `
Generate a React Three Fiber component and inject it into the running scene.

═══ QUALITY GUIDELINES (follow these for every component) ════════════════════════
MATERIALS:
• NEVER meshBasicMaterial for lit objects — default to meshStandardMaterial.
• Set metalness + roughness explicitly. Glass → MeshTransmissionMaterial (import from drei).
• For glow: set emissive + emissiveIntensity AND lift color above 1 (color={[5, 2, 0]}) to feed Bloom.
• For "wow": layer HDRI environment + Bloom + SoftShadows + MeshTransmissionMaterial + Sparkles/Trail.

ANIMATION:
• ALWAYS use delta: useFrame((state, delta) => { ref.current.rotation.y += delta * speed }).
• Use damp / damp3 from 'maath/easing' for frame-rate-independent smooth following.
• Different frequencies per axis for organic motion: sin(t*0.7), cos(t*1.3), sin(t*1.1).
• Prefer Drei <Float> for bobbing, <Trail> for motion trails, @react-spring/three for interactive springs.

STRUCTURE:
• Mutate refs in useFrame — NEVER setState inside useFrame (kills frame rate).
• Hoist allocations above useFrame: const v = useMemo(() => new THREE.Vector3(), []).
• Wrap objects in <group> for clean transform management.
• Use useRef<THREE.Mesh>(null) type annotations.

SCALE & GEOMETRY:
• For count > ~20 of same geometry: use instancedMesh, never .map() of <mesh>.
• Low-poly for particles: sphereGeometry [r, 6, 6] not [r, 32, 32].
• Keep geometry detail proportional — reduce segments for small/distant objects.

SCENE INTEGRATION:
• Respect the scene's existing aesthetic — match colors, materials, and scale.
• If the scene has fog, ensure the component blends into it (don't use pure white materials).
• include castShadow/receiveShadow when the scene has shadows enabled.
• Prefer Drei pre-built materials (MeshTransmissionMaterial, MeshReflectorMaterial) over hand-rolled.

For additional guidance: call r3f_reference({ topics: ["heuristics", "materials", "animation"] })
═══════════════════════════════════════════════════════════════════════════════════

═══ TASK ════════════════════════════════════════════════════════════════════════
Name:        ${args.name}
Position:    ${pos}
Description: ${args.description}

═══ STYLE CONTEXT ═══════════════════════════════════════════════════════════════
Scene type detected: ${env.label}
${env.notes}

Palette: ${env.colorPalette}
Materials: ${env.suggestedMaterials}
Avoid: ${env.avoidList}
═════════════════════════════════════════════════════════════════════════════════

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
• Fit the visual style of the existing scene (see scene context above)
• When done, call inject_code with:
    - code: the complete component source
    - name: "${args.name}"
    ${args.preview ? '(preview: true is default)' : ''}

Example of a quality component:
\`\`\`tsx
export default function ${args.name}() {
  const ref = useRef<THREE.Mesh>(null);
  // Delta-time ensures frame-rate independence
  useFrame((state, delta) => {
    if (!ref.current) return;
    const t = state.clock.elapsedTime;
    ref.current.rotation.y += delta * 0.5;
    // Different frequencies = organic, non-mechanical motion
    ref.current.position.y = ${pos}[1] + Math.sin(t * 0.7) * 0.15;
    ref.current.rotation.z = Math.sin(t * 0.3) * 0.05;
  });
  return (
    <group position={${pos}}>
      <mesh ref={ref} castShadow receiveShadow>
        <boxGeometry args={[1, 1, 1]} />
        {/* Standard material with explicit PBR values */}
        <meshStandardMaterial color="#c0a060" metalness={0.4} roughness={0.3} />
      </mesh>
    </group>
  );
}
\`\`\`

Now generate the ${args.name} component following the quality guidelines above, then call inject_code.
`.trim();

  return { content: [{ type: 'text', text: instructions }] };
}
