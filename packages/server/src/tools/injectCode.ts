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
    'Runs a quality check before injection and returns warnings for common issues. ' +
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

// ─── Quality validator ────────────────────────────────────────────────────────

interface QualityWarning {
  rule: string;
  message: string;
  suggestion: string;
}

function validateQuality(code: string): QualityWarning[] {
  const warnings: QualityWarning[] = [];

  // 1. meshBasicMaterial for visible geometry
  if (/meshBasicMaterial/i.test(code) && !/wireframe.*true/i.test(code)) {
    warnings.push({
      rule: 'flat-material',
      message: 'Uses meshBasicMaterial (unlit — no shadows, no environment reflections)',
      suggestion: 'Switch to meshStandardMaterial with metalness/roughness for realistic lighting',
    });
  }

  // 2. No lighting references at all
  const hasLighting =
    /directionalLight|pointLight|spotLight|ambientLight|Environment|hemisphereLight/i.test(code);
  if (!hasLighting) {
    warnings.push({
      rule: 'no-lighting',
      message: 'No lighting or environment defined in this component',
      suggestion:
        'If the scene already has lighting this is fine; otherwise add ' +
        '<ambientLight intensity={0.3} /> and a directionalLight, or <Environment preset="studio" />',
    });
  }

  // 3. useFrame without delta — catches the common mistake of omitting delta
  //    Only flag if transforms are being mutated (rotation, position, scale)
  if (/useFrame/.test(code) && /\.(rotation|position)\.[xyz]\s*[+\-]?=/.test(code)) {
    const hasDelta = /useFrame\s*\(\s*\([^)]*,\s*delta/.test(code);
    if (!hasDelta) {
      warnings.push({
        rule: 'no-delta',
        message: 'useFrame mutates transforms but the callback is missing the delta parameter',
        suggestion:
          'Change signature to useFrame((state, delta) => { ... }) and multiply all ' +
          'speed values by delta for frame-rate-independent animation',
      });
    }
  }

  // 4. Individual meshes in a map/loop — likely should be instancedMesh
  const hasLoopMesh = /(?:\.map|for\s*\(|Array\.from)\s*[^}]{0,200}<mesh/s.test(code);
  if (hasLoopMesh) {
    warnings.push({
      rule: 'loop-mesh',
      message: 'Creates individual <mesh> elements inside a loop/map',
      suggestion:
        'For many identical objects use <instancedMesh> (single draw call) — ' +
        'e.g. <instancedMesh args={[undefined, undefined, count]}> with setMatrixAt in useFrame',
    });
  }

  // 5. High-poly geometry for potentially small objects
  const highPolyMatch = code.match(/<sphereGeometry\s+args=\{\[([^\]]+)\]\}/);
  if (highPolyMatch) {
    const parts = highPolyMatch[1].split(',').map(s => parseFloat(s.trim()));
    const wSeg = parts[1] ?? 0;
    const hSeg = parts[2] ?? 0;
    if (wSeg > 24 || hSeg > 24) {
      warnings.push({
        rule: 'high-poly',
        message: `sphereGeometry uses high segment counts (${wSeg}×${hSeg})`,
        suggestion:
          'For objects smaller than ~1 unit use args={[r, 12, 12]}; ' +
          'high segments are only needed for close-up hero objects',
      });
    }
  }

  return warnings;
}

// ─── Handler ──────────────────────────────────────────────────────────────────

type InjectContent = { content: Array<{ type: 'text'; text: string }> };

export async function handleInjectCode(
  args: InjectCodeInput,
  connection: WebSocketManager,
): Promise<InjectContent> {
  const name = args.name ?? `injection_${Date.now()}`;

  // ── Quality check before injection ────────────────────────────────────────
  const warnings = validateQuality(args.code);

  // ── Inject ────────────────────────────────────────────────────────────────
  const result = await connection.requestInjectCode(args.code, name, args.replace);

  // ── Build response ────────────────────────────────────────────────────────
  const lines: string[] = [];

  if (result.success) {
    lines.push(
      `Injected "${result.name}" (UUID: ${result.uuid}).`,
      `The component is now live in the running scene.`,
      `Call commit_component with name="${result.name}" to save it to a file.`,
    );
  } else {
    lines.push(
      `Injection failed — ${result.error ?? 'unknown error'}.`,
      `Fix the code and call inject_code again with replace="${name}".`,
    );
  }

  if (warnings.length > 0) {
    lines.push('');
    lines.push(`⚠️  Quality suggestions (${warnings.length}):`);
    for (const w of warnings) {
      lines.push(`  • ${w.message}`);
      lines.push(`    → ${w.suggestion}`);
    }
    if (result.success) {
      lines.push('');
      lines.push(
        'Consider addressing these before committing. ' +
        'Re-inject with replace="' + name + '" after fixing.',
      );
    }
  }

  return { content: [{ type: 'text', text: lines.join('\n') }] };
}
