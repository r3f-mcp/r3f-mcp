import { z } from 'zod';

// ─── Geometry ────────────────────────────────────────────────────────────────

export interface SerializedGeometry {
  type: string;
  parameters: Record<string, number | boolean>;
}

// ─── Material ────────────────────────────────────────────────────────────────

export type MaterialSide = 'FrontSide' | 'BackSide' | 'DoubleSide';

export interface SerializedMaterial {
  type: string;
  color?: string;
  opacity: number;
  transparent: boolean;
  wireframe?: boolean;
  metalness?: number;
  roughness?: number;
  emissive?: string;
  emissiveIntensity?: number;
  map?: string;
  side?: MaterialSide;
}

// ─── Light ───────────────────────────────────────────────────────────────────

export interface SerializedLight {
  color: string;
  intensity: number;
  distance?: number;
  decay?: number;
  angle?: number;
  penumbra?: number;
  groundColor?: string;
  width?: number;
  height?: number;
}

// ─── Camera ──────────────────────────────────────────────────────────────────

export interface SerializedCamera {
  near: number;
  far: number;
  fov?: number;
  aspect?: number;
  left?: number;
  right?: number;
  top?: number;
  bottom?: number;
  zoom?: number;
}

// ─── Scene node ──────────────────────────────────────────────────────────────

export interface SerializedNode {
  uuid: string;
  name: string;
  type: string;
  position: [number, number, number];
  rotation: [number, number, number];
  scale: [number, number, number];
  visible: boolean;
  castShadow: boolean;
  receiveShadow: boolean;
  userData: Record<string, unknown>;
  children: SerializedNode[];
  geometry?: SerializedGeometry;
  material?: SerializedMaterial | SerializedMaterial[];
  light?: SerializedLight;
  camera?: SerializedCamera;
}

// ─── Add-object spec ─────────────────────────────────────────────────────────

export interface AddObjectGeometrySpec {
  type:
    | 'box' | 'sphere' | 'cylinder' | 'cone' | 'torus' | 'plane'
    | 'torusKnot' | 'icosahedron' | 'octahedron' | 'ring' | 'dodecahedron';
  args?: number[];
}

export interface AddObjectMaterialSpec {
  type?: 'standard' | 'basic' | 'phong' | 'lambert' | 'physical';
  color?: string;
  opacity?: number;
  transparent?: boolean;
  metalness?: number;
  roughness?: number;
  wireframe?: boolean;
  side?: 'front' | 'back' | 'double';
}

export interface AddObjectPayload {
  name: string;
  type: 'mesh' | 'group' | 'directionalLight' | 'pointLight' | 'spotLight' | 'ambientLight';
  position?: [number, number, number];
  rotation?: [number, number, number];
  scale?: [number, number, number];
  parent?: string;
  geometry?: AddObjectGeometrySpec;
  material?: AddObjectMaterialSpec;
  color?: string;
  intensity?: number;
  distance?: number;
  angle?: number;
  penumbra?: number;
  castShadow?: boolean;
}

// ─── Spatial query result types ───────────────────────────────────────────────

export interface BoundsResult {
  min:    [number, number, number];
  max:    [number, number, number];
  center: [number, number, number];
  size:   [number, number, number];
}

export interface DistanceResult {
  distance:     number;
  fromPosition: [number, number, number];
  toPosition:   [number, number, number];
  vector:       [number, number, number];
}

export interface FrustumVisibleObject {
  name:          string;
  uuid:          string;
  type:          string;
  worldPosition: [number, number, number];
}

export interface FrustumResult {
  visibleObjects: FrustumVisibleObject[];
  totalObjects:   number;
  visibleCount:   number;
}

// ─── WebSocket protocol (mirrors packages/client/src/types.ts) ───────────────

// Server → Client

export interface GetSceneGraphMessage {
  type: 'get_scene_graph';
  requestId: string;
}

export interface GetObjectMessage {
  type: 'get_object';
  requestId: string;
  payload: { id: string };
}

export interface SetTransformMessage {
  type: 'set_transform';
  requestId: string;
  payload: {
    id: string;
    position?: [number, number, number];
    rotation?: [number, number, number];
    scale?: [number, number, number];
  };
}

export interface SetMaterialMessage {
  type: 'set_material';
  requestId: string;
  payload: {
    id: string;
    color?: string;
    roughness?: number;
    metalness?: number;
    opacity?: number;
    transparent?: boolean;
    wireframe?: boolean;
    emissive?: string;
    emissiveIntensity?: number;
  };
}

export interface SetVisibleMessage {
  type: 'set_visible';
  requestId: string;
  payload: { id: string; visible: boolean };
}

export interface TakeScreenshotMessage {
  type: 'take_screenshot';
  requestId: string;
  payload: { width?: number; height?: number };
}

export interface AddObjectMessage {
  type: 'add_object';
  requestId: string;
  payload: AddObjectPayload;
}

export interface RemoveObjectMessage {
  type: 'remove_object';
  requestId: string;
  payload: { id: string };
}

export interface QueryBoundsMessage {
  type: 'query_bounds';
  requestId: string;
  payload: { id: string };
}

export interface QueryDistanceMessage {
  type: 'query_distance';
  requestId: string;
  payload: { fromId: string; toId: string };
}

export interface QueryFrustumMessage {
  type: 'query_frustum';
  requestId: string;
  payload: { cameraId?: string };
}

export interface InjectCodeMessage {
  type: 'inject_code';
  requestId: string;
  payload: { code: string; name: string; replace?: string };
}

export interface RemoveInjectionMessage {
  type: 'remove_injection';
  requestId: string;
  payload: { name: string };
}

export interface GetInjectionsMessage {
  type: 'get_injections';
  requestId: string;
}

export interface GetAnimationsMessage {
  type: 'get_animations';
  requestId: string;
  payload: { identifier?: string };
}

export interface ControlAnimationMessage {
  type: 'control_animation';
  requestId: string;
  payload: {
    target: string;
    action: 'play' | 'pause' | 'stop' | 'seek';
    time?: number;
    animationName?: string;
  };
}

export interface GetPhysicsMessage {
  type: 'get_physics';
  requestId: string;
  payload: { identifier?: string };
}

export interface GetPerformanceMessage {
  type: 'get_performance';
  requestId: string;
}

export interface StartProfileMessage {
  type: 'start_profile';
  requestId: string;
  payload: { duration: number };
}

export type ServerToClientMessage =
  | GetSceneGraphMessage
  | GetObjectMessage
  | SetTransformMessage
  | SetMaterialMessage
  | SetVisibleMessage
  | TakeScreenshotMessage
  | AddObjectMessage
  | RemoveObjectMessage
  | QueryBoundsMessage
  | QueryDistanceMessage
  | QueryFrustumMessage
  | GetAnimationsMessage
  | ControlAnimationMessage
  | GetPhysicsMessage
  | GetPerformanceMessage
  | StartProfileMessage
  | InjectCodeMessage
  | RemoveInjectionMessage
  | GetInjectionsMessage;

// Client → Server

export interface SceneGraphResponseMessage {
  type: 'scene_graph_response';
  requestId: string;
  payload: { scene: SerializedNode };
}

export interface ObjectResponseMessage {
  type: 'object_response';
  requestId: string;
  payload: { object: SerializedNode | null };
}

export interface ScreenshotResponseMessage {
  type: 'screenshot_response';
  requestId: string;
  payload: { image: string; width: number; height: number };
}

export interface EditConfirmationMessage {
  type: 'edit_confirmation';
  requestId: string;
  payload: { id: string; property: string; success: boolean };
}

export interface ErrorMessage {
  type: 'error';
  requestId: string;
  payload: { message: string; code?: string };
}

export interface AddObjectResponseMessage {
  type: 'add_object_response';
  requestId: string;
  payload: { uuid: string; name: string };
}

export interface RemoveObjectResponseMessage {
  type: 'remove_object_response';
  requestId: string;
  payload: { uuid: string; name: string };
}

export interface QueryBoundsResponseMessage {
  type: 'query_bounds_response';
  requestId: string;
  payload: BoundsResult;
}

export interface QueryDistanceResponseMessage {
  type: 'query_distance_response';
  requestId: string;
  payload: DistanceResult;
}

export interface QueryFrustumResponseMessage {
  type: 'query_frustum_response';
  requestId: string;
  payload: FrustumResult;
}

// ─── v0.3 result shapes ───────────────────────────────────────────────────────

export interface AnimationInfo {
  name: string;
  target: string;
  property: string;
  duration: number;
  elapsed: number;
  progress: number;
  loop: boolean;
  paused: boolean;
  type: 'mixer' | 'spring' | 'gsap' | 'custom' | 'unknown';
}

export interface AnimationControlResult {
  success: boolean;
  animation: string;
  state: 'playing' | 'paused' | 'stopped';
  currentTime: number;
}

export interface PhysicsCollider {
  shape: string;
  halfExtents?: [number, number, number];
  radius?: number;
  isSensor: boolean;
  friction: number;
  restitution: number;
}

export interface PhysicsBody {
  name: string;
  uuid: string;
  bodyType: 'dynamic' | 'fixed' | 'kinematicPosition' | 'kinematicVelocity';
  position: [number, number, number];
  rotation: [number, number, number, number];
  linearVelocity:  [number, number, number];
  angularVelocity: [number, number, number];
  mass: number;
  colliders: PhysicsCollider[];
  isSleeping: boolean;
  isEnabled: boolean;
}

export interface PhysicsJoint {
  type: string;
  body1: string;
  body2: string;
  anchor1: [number, number, number];
  anchor2: [number, number, number];
}

export interface PhysicsResult {
  available: boolean;
  message?: string;
  bodies?: PhysicsBody[];
  joints?: PhysicsJoint[];
  gravity?: [number, number, number];
  totalBodies?: number;
  activeBodies?: number;
}

export interface SceneStats {
  totalObjects:   number;
  visibleObjects: number;
  meshCount:  number;
  lightCount: number;
  groupCount: number;
}

export interface PerformanceResult {
  fps: number; frameTime: number;
  drawCalls: number; triangles: number; points: number; lines: number;
  geometries: number; textures: number; programs: number;
  memory: { geometries: number; textures: number };
  scene: SceneStats;
}

export interface HeavyObject {
  name: string; uuid: string; triangles: number; drawCalls: number;
}

export interface ProfileResult {
  duration: number;
  frames: number;
  fps: { min: number; max: number; average: number; median: number; p99: number };
  drawCalls: { min: number; max: number; average: number };
  triangles: { min: number; max: number; average: number };
  heaviestObjects: HeavyObject[];
  recommendations: string[];
}

// ─── v0.3 response messages ───────────────────────────────────────────────────

export interface AnimationsResponseMessage {
  type: 'animations_response';
  requestId: string;
  payload: { animations: AnimationInfo[]; totalAnimations: number };
}

export interface AnimationControlResponseMessage {
  type: 'animation_control_response';
  requestId: string;
  payload: AnimationControlResult;
}

export interface PhysicsResponseMessage {
  type: 'physics_response';
  requestId: string;
  payload: PhysicsResult;
}

export interface PerformanceResponseMessage {
  type: 'performance_response';
  requestId: string;
  payload: PerformanceResult;
}

export interface ProfileResponseMessage {
  type: 'profile_response';
  requestId: string;
  payload: ProfileResult;
}

export interface InjectCodeResponseMessage {
  type: 'inject_code_response';
  requestId: string;
  payload: { success: boolean; uuid: string; name: string; error?: string };
}

export interface InjectionRemovedResponseMessage {
  type: 'injection_removed_response';
  requestId: string;
  payload: { success: boolean; name: string };
}

export interface InjectionEntry {
  name: string;
  uuid: string;
  code: string;
  injectedAt: string;
  hasErrors: boolean;
}

export interface InjectionsListResponseMessage {
  type: 'injections_list_response';
  requestId: string;
  payload: { injections: InjectionEntry[] };
}

export type ClientToServerMessage =
  | SceneGraphResponseMessage
  | ObjectResponseMessage
  | ScreenshotResponseMessage
  | EditConfirmationMessage
  | ErrorMessage
  | AddObjectResponseMessage
  | RemoveObjectResponseMessage
  | QueryBoundsResponseMessage
  | QueryDistanceResponseMessage
  | QueryFrustumResponseMessage
  | AnimationsResponseMessage
  | AnimationControlResponseMessage
  | PhysicsResponseMessage
  | PerformanceResponseMessage
  | ProfileResponseMessage
  | InjectCodeResponseMessage
  | InjectionRemovedResponseMessage
  | InjectionsListResponseMessage;

// ─── Server config ───────────────────────────────────────────────────────────

export interface ServerConfig {
  wsUrl: string;
}

// ─── Zod schemas for MCP tool inputs ─────────────────────────────────────────
//
// These are the source of truth for runtime validation of arguments that AI
// tools pass into the MCP server. The inferred TypeScript types below are
// derived directly from the schemas so they never diverge.

const Vec3 = z.tuple([z.number(), z.number(), z.number()]);

// get_scene_graph — no inputs
export const GetSceneGraphInputSchema = z.object({});
export type GetSceneGraphInput = z.infer<typeof GetSceneGraphInputSchema>;

// get_object
export const GetObjectInputSchema = z.object({
  id: z.string().describe('UUID or name of the object'),
});
export type GetObjectInput = z.infer<typeof GetObjectInputSchema>;

// set_transform
export const SetTransformInputSchema = z.object({
  id: z.string().describe('UUID or name of the object'),
  position: Vec3.optional().describe('[x, y, z] world-space position'),
  rotation: Vec3.optional().describe('[x, y, z] Euler rotation in radians (XYZ order)'),
  scale: Vec3.optional().describe('[x, y, z] scale'),
});
export type SetTransformInput = z.infer<typeof SetTransformInputSchema>;

// set_material
export const SetMaterialInputSchema = z.object({
  id: z.string().describe('UUID or name of the object'),
  color: z
    .string()
    .optional()
    .describe("CSS color string or hex value, e.g. '#ff8800' or 'orange'"),
  roughness: z.number().min(0).max(1).optional(),
  metalness: z.number().min(0).max(1).optional(),
  opacity: z.number().min(0).max(1).optional(),
  transparent: z.boolean().optional(),
  wireframe: z.boolean().optional(),
  emissive: z.string().optional().describe('Emissive color as CSS/hex string'),
  emissiveIntensity: z.number().min(0).optional(),
});
export type SetMaterialInput = z.infer<typeof SetMaterialInputSchema>;

// set_visible
export const SetVisibleInputSchema = z.object({
  id: z.string().describe('UUID or name of the object'),
  visible: z.boolean(),
});
export type SetVisibleInput = z.infer<typeof SetVisibleInputSchema>;

// take_screenshot / screenshot
export const TakeScreenshotInputSchema = z.object({
  width: z.number().int().positive().optional().describe('Output width in pixels'),
  height: z.number().int().positive().optional().describe('Output height in pixels'),
});
export type TakeScreenshotInput = z.infer<typeof TakeScreenshotInputSchema>;

// add_object
const AddObjectGeometrySchema = z.object({
  type: z.enum(['box', 'sphere', 'cylinder', 'cone', 'torus', 'plane',
    'torusKnot', 'icosahedron', 'octahedron', 'ring', 'dodecahedron']),
  args: z.array(z.number()).optional().describe('Geometry constructor arguments'),
});

const AddObjectMaterialSchema = z.object({
  type:        z.enum(['standard', 'basic', 'phong', 'lambert', 'physical']).optional(),
  color:       z.string().optional().describe("Hex or CSS color, e.g. '#ff0000' or 'red'"),
  opacity:     z.number().min(0).max(1).optional(),
  transparent: z.boolean().optional(),
  metalness:   z.number().min(0).max(1).optional(),
  roughness:   z.number().min(0).max(1).optional(),
  wireframe:   z.boolean().optional(),
  side:        z.enum(['front', 'back', 'double']).optional(),
});

export const AddObjectInputSchema = z.object({
  name: z.string().describe('Name for the new object'),
  type: z.enum(['mesh', 'group', 'directionalLight', 'pointLight', 'spotLight', 'ambientLight'])
    .describe('Type of object to create'),
  position:   Vec3.optional().describe('[x, y, z] world-space position (default [0,0,0])'),
  rotation:   Vec3.optional().describe('[x, y, z] Euler rotation in radians (default [0,0,0])'),
  scale:      Vec3.optional().describe('[x, y, z] scale factors (default [1,1,1])'),
  parent:     z.string().optional().describe('Name or UUID of parent (default: scene root)'),
  geometry:   AddObjectGeometrySchema.optional().describe('Geometry spec — for type "mesh"'),
  material:   AddObjectMaterialSchema.optional().describe('Material spec — for type "mesh"'),
  color:      z.string().optional().describe('Light color as hex/CSS (light types only)'),
  intensity:  z.number().optional().describe('Light intensity (light types only)'),
  distance:   z.number().optional().describe('Light range (pointLight / spotLight only)'),
  angle:      z.number().optional().describe('SpotLight cone angle in radians'),
  penumbra:   z.number().min(0).max(1).optional().describe('SpotLight penumbra 0–1'),
  castShadow: z.boolean().optional().describe('Whether this object casts shadows'),
});
export type AddObjectInput = z.infer<typeof AddObjectInputSchema>;

// remove_object
export const RemoveObjectInputSchema = z.object({
  identifier: z.string().describe('Name or UUID of the object to remove'),
});
export type RemoveObjectInput = z.infer<typeof RemoveObjectInputSchema>;

// query_bounds
export const QueryBoundsInputSchema = z.object({
  identifier: z.string().describe('Name or UUID of the object'),
});
export type QueryBoundsInput = z.infer<typeof QueryBoundsInputSchema>;

// query_distance
export const QueryDistanceInputSchema = z.object({
  from: z.string().describe('Name or UUID of the first object'),
  to:   z.string().describe('Name or UUID of the second object'),
});
export type QueryDistanceInput = z.infer<typeof QueryDistanceInputSchema>;

// query_frustum
export const QueryFrustumInputSchema = z.object({
  camera: z.string().optional()
    .describe('Name or UUID of camera (default: the scene active camera)'),
});
export type QueryFrustumInput = z.infer<typeof QueryFrustumInputSchema>;

// scene_diff
export const SceneDiffInputSchema = z.object({});
export type SceneDiffInput = z.infer<typeof SceneDiffInputSchema>;

// get_animations
export const GetAnimationsInputSchema = z.object({
  identifier: z.string().optional()
    .describe('Filter to animations on a specific object (name or UUID)'),
});
export type GetAnimationsInput = z.infer<typeof GetAnimationsInputSchema>;

// control_animation
export const ControlAnimationInputSchema = z.object({
  target: z.string().describe('Name or UUID of the animated object'),
  action: z.enum(['play', 'pause', 'stop', 'seek']),
  time: z.number().optional().describe('Seek target in seconds (use with action "seek")'),
  animationName: z.string().optional()
    .describe('Clip name when the object has multiple animations'),
});
export type ControlAnimationInput = z.infer<typeof ControlAnimationInputSchema>;

// get_physics
export const GetPhysicsInputSchema = z.object({
  identifier: z.string().optional()
    .describe('Filter to physics bodies attached to a specific object (name or UUID)'),
});
export type GetPhysicsInput = z.infer<typeof GetPhysicsInputSchema>;

// get_performance
export const GetPerformanceInputSchema = z.object({});
export type GetPerformanceInput = z.infer<typeof GetPerformanceInputSchema>;

// get_performance_profile
export const GetPerformanceProfileInputSchema = z.object({
  duration: z.number().min(0.5).max(30).optional()
    .describe('Profiling duration in seconds (default 3, max 30)'),
});
export type GetPerformanceProfileInput = z.infer<typeof GetPerformanceProfileInputSchema>;

// ── v0.4 schemas ──────────────────────────────────────────────────────────────

export const GenerateComponentInputSchema = z.object({
  description: z.string().describe('Natural language description of the component to generate'),
  name:        z.string().describe('PascalCase component name, e.g. "FloatingCube"'),
  position:    Vec3.optional().describe('[x, y, z] where to place it in the scene'),
  preview:     z.boolean().default(true).describe('Inject into the running scene immediately'),
});
export type GenerateComponentInput = z.infer<typeof GenerateComponentInputSchema>;

export const InjectCodeInputSchema = z.object({
  code:    z.string().describe('Valid JSX/TSX source code that returns an R3F-compatible element'),
  name:    z.string().optional().describe('Identifier for this injection (used for remove/replace)'),
  replace: z.string().optional().describe('Name of a previous injection to replace'),
});
export type InjectCodeInput = z.infer<typeof InjectCodeInputSchema>;

export const CommitComponentInputSchema = z.object({
  name:      z.string().describe('Injection name to commit'),
  directory: z.string().optional().describe('Directory to save to (default: "./src/components")'),
  filename:  z.string().optional().describe('Override filename (default: {Name}.tsx)'),
});
export type CommitComponentInput = z.infer<typeof CommitComponentInputSchema>;

export const ScaffoldProjectInputSchema = z.object({
  description: z.string().describe('What to build, e.g. "a space shooter game"'),
  directory:   z.string().describe('Where to create the project'),
  template:    z.enum(['game', 'showcase', 'portfolio', 'visualization', 'experience']).optional(),
  features:    z.array(z.string()).optional()
    .describe('Specific features, e.g. ["physics","postprocessing","sound"]'),
});
export type ScaffoldProjectInput = z.infer<typeof ScaffoldProjectInputSchema>;

export const ListInjectionsInputSchema = z.object({});
export type ListInjectionsInput = z.infer<typeof ListInjectionsInputSchema>;

export const RemoveInjectionInputSchema = z.object({
  name: z.string().describe('Name of the injection to remove'),
});
export type RemoveInjectionInput = z.infer<typeof RemoveInjectionInputSchema>;

// Convenience map used by the dispatcher in index.ts
export const ToolInputSchemas = {
  get_scene_graph: GetSceneGraphInputSchema,
  get_object:      GetObjectInputSchema,
  set_transform:   SetTransformInputSchema,
  set_material:    SetMaterialInputSchema,
  set_visible:     SetVisibleInputSchema,
  screenshot:      TakeScreenshotInputSchema,
  add_object:      AddObjectInputSchema,
  remove_object:   RemoveObjectInputSchema,
  query_bounds:    QueryBoundsInputSchema,
  query_distance:  QueryDistanceInputSchema,
  query_frustum:   QueryFrustumInputSchema,
  scene_diff:      SceneDiffInputSchema,
} as const;

export type ToolName = keyof typeof ToolInputSchemas;
