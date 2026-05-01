import * as React from 'react';
import * as THREE from 'three';
import { useFrame, useThree } from '@react-three/fiber';
import { transform } from 'sucrase';

// ─── Scope ────────────────────────────────────────────────────────────────────
//
// Every injected component gets these names in scope via the Function constructor.
// The scope intentionally excludes @react-three/drei because it is not a peer
// dep of r3f-mcp. If the host app has drei installed, users can import it
// directly in their hand-written code, but generated components should rely
// only on the guaranteed-available scope below.

export type InjectionScope = Record<string, unknown>;

export function buildInjectionScope(): InjectionScope {
  return {
    // React — the object itself (needed for React.createElement in JSX output)
    React,
    // Named React hooks (destructured for ergonomic generated code)
    useState:    React.useState,
    useEffect:   React.useEffect,
    useRef:      React.useRef,
    useMemo:     React.useMemo,
    useCallback: React.useCallback,
    useContext:  React.useContext,
    useReducer:  React.useReducer,
    // @react-three/fiber
    useFrame,
    useThree,
    // Three.js — full namespace so generated code can do `new THREE.BoxGeometry`
    THREE,
    // Common Three.js classes as top-level names for concise generated code
    Vector2:   THREE.Vector2,
    Vector3:   THREE.Vector3,
    Color:     THREE.Color,
    Euler:     THREE.Euler,
    MathUtils: THREE.MathUtils,
  };
}

// ─── Evaluator ────────────────────────────────────────────────────────────────

export interface EvaluationResult {
  Component: React.ComponentType | null;
  error: string | null;
}

/**
 * Transform JSX/TSX component code with sucrase and evaluate it in a sandboxed
 * Function with all scope variables injected as parameters.
 *
 * The component must export a default functional React component.
 * Import statements are stripped — all dependencies come from `scope`.
 *
 * @example
 * const { Component, error } = evaluateComponent(`
 *   export default function Spinner() {
 *     const ref = useRef(null);
 *     useFrame(() => { ref.current.rotation.y += 0.01; });
 *     return (
 *       <mesh ref={ref}>
 *         <torusGeometry args={[1, 0.3, 16, 32]} />
 *         <meshStandardMaterial color="hotpink" />
 *       </mesh>
 *     );
 *   }
 * `, buildInjectionScope());
 */
export function evaluateComponent(
  code: string,
  scope: InjectionScope,
): EvaluationResult {
  try {
    // ── Step 1: Transform JSX + TypeScript → plain JavaScript ─────────────────
    const { code: jsCode } = transform(code, {
      transforms:         ['jsx', 'typescript'],
      jsxRuntime:         'classic',
      jsxPragma:          'React.createElement',
      jsxFragmentPragma:  'React.Fragment',
      keepUnusedImports:  false,
    });

    // ── Step 2: Pre-process ───────────────────────────────────────────────────
    // Remove import statements — every dependency is available via scope.
    // Rewrite `export default` so we can capture the value and return it.
    const processed = jsCode
      .replace(/^\s*import\s[^;]+;?\s*\n?/gm, '')
      .replace(/^\s*export\s+default\s+/gm, 'var __default__ = ');

    // ── Step 3: Evaluate ──────────────────────────────────────────────────────
    // Build a Function whose parameters are the scope keys.  The body runs the
    // processed component code, then returns the default export.
    const body = `"use strict";\nvar __default__ = null;\n${processed}\nreturn __default__;`;

    // eslint-disable-next-line @typescript-eslint/no-implied-eval
    const fn = new Function(...Object.keys(scope), body);
    const result = fn(...Object.values(scope)) as React.ComponentType | null;

    if (typeof result !== 'function') {
      return {
        Component: null,
        error: 'Component code must have a default-exported function. ' +
               'Make sure the component ends with `export default ComponentName;` ' +
               'or `export default function ComponentName() { ... }`.',
      };
    }

    return { Component: result, error: null };
  } catch (err) {
    const msg = err instanceof Error ? `${err.name}: ${err.message}` : String(err);
    return { Component: null, error: msg };
  }
}
