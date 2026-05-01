import { useEffect } from 'react';

// ─── Module-level registry ────────────────────────────────────────────────────
//
// Stores a reference to the @react-three/rapier physics world so MCPProvider
// can read body/collider/joint state on demand without being inside the <Physics>
// provider itself.

let physicsWorld: unknown = null;

export function registerPhysicsWorld(world: unknown): void {
  physicsWorld = world;
}

export function unregisterPhysicsWorld(): void {
  physicsWorld = null;
}

export function getPhysicsWorld(): unknown {
  return physicsWorld;
}

// ─── React hook ───────────────────────────────────────────────────────────────

/**
 * Register the Rapier physics world with r3f-mcp so that `get_physics` can
 * inspect rigid bodies, colliders, and joints.
 *
 * Call this inside a component that is a descendant of `<Physics>` (e.g. the
 * component that sets up your physics scene). The registration is removed when
 * the component unmounts.
 *
 * @example
 * ```tsx
 * import { useRapier } from '@react-three/rapier';
 * import { useRegisterPhysics } from 'r3f-mcp';
 *
 * function PhysicsScene() {
 *   const { world } = useRapier();
 *   useRegisterPhysics(world);
 *   return <>{children}</>;
 * }
 * ```
 */
export function useRegisterPhysics(world: unknown): void {
  useEffect(() => {
    if (!world) return;
    registerPhysicsWorld(world);
    return () => unregisterPhysicsWorld();
  }, [world]);
}
