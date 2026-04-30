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

export type ServerToClientMessage =
  | GetSceneGraphMessage
  | GetObjectMessage
  | SetTransformMessage
  | SetMaterialMessage
  | SetVisibleMessage
  | TakeScreenshotMessage;

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

export type ClientToServerMessage =
  | SceneGraphResponseMessage
  | ObjectResponseMessage
  | ScreenshotResponseMessage
  | EditConfirmationMessage
  | ErrorMessage;

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

// Convenience map used by the dispatcher in index.ts
export const ToolInputSchemas = {
  get_scene_graph: GetSceneGraphInputSchema,
  get_object: GetObjectInputSchema,
  set_transform: SetTransformInputSchema,
  set_material: SetMaterialInputSchema,
  set_visible: SetVisibleInputSchema,
  screenshot: TakeScreenshotInputSchema,
} as const;

export type ToolName = keyof typeof ToolInputSchemas;
