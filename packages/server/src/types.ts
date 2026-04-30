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
  | QueryFrustumMessage;

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
  | QueryFrustumResponseMessage;

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
