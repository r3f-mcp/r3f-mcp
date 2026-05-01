import { useEffect } from 'react';
import type { AnimationMixer, Object3D } from 'three';

// ─── Module-level registry ────────────────────────────────────────────────────
//
// Stores AnimationMixer instances keyed by the Three.js object's UUID so the
// MCPProvider can enumerate all active animations without React tree traversal.

interface MixerEntry {
  mixer: AnimationMixer;
  /** Display name — object.name or the UUID if name is empty */
  label: string;
}

const registry = new Map<string, MixerEntry>();

export function registerMixer(uuid: string, mixer: AnimationMixer, label: string): void {
  registry.set(uuid, { mixer, label });
}

export function unregisterMixer(uuid: string): void {
  registry.delete(uuid);
}

export function getAllMixerEntries(): ReadonlyMap<string, MixerEntry> {
  return registry;
}

// ─── React hook ───────────────────────────────────────────────────────────────

/**
 * Register an `AnimationMixer` with r3f-mcp so that `get_animations` and
 * `control_animation` can inspect and control it.
 *
 * Call this inside the component that owns the mixer. The registration is
 * cleaned up automatically when the component unmounts.
 *
 * @example
 * ```tsx
 * import { useAnimations } from '@react-three/drei';
 * import { useRegisterAnimation } from 'r3f-mcp';
 *
 * function Model({ url }) {
 *   const { scene, mixer, animations } = useGLTF(url);
 *   const { ref } = useAnimations(animations, scene);
 *   useRegisterAnimation(ref.current, mixer);
 *   return <primitive ref={ref} object={scene} />;
 * }
 * ```
 */
export function useRegisterAnimation(
  object: Object3D | null | undefined,
  mixer: AnimationMixer | null | undefined,
): void {
  useEffect(() => {
    if (!object || !mixer) return;
    const label = object.name || object.uuid;
    registerMixer(object.uuid, mixer, label);
    return () => unregisterMixer(object.uuid);
  }, [object, mixer]);
}
