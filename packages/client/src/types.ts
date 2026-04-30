import type { ReactNode } from 'react';

// ─── Geometry ────────────────────────────────────────────────────────────────

export interface SerializedGeometry {
  /** Three.js class name, e.g. 'BoxGeometry', 'SphereGeometry' */
  type: string;
  /** Constructor parameters exactly as stored in geometry.parameters */
  parameters: Record<string, number | boolean>;
}

// ─── Material ────────────────────────────────────────────────────────────────

export type MaterialSide = 'FrontSide' | 'BackSide' | 'DoubleSide';

export interface SerializedMaterial {
  /** Three.js class name, e.g. 'MeshStandardMaterial' */
  type: string;
  /** Hex color string, e.g. '#ff8800' */
  color?: string;
  opacity: number;
  transparent: boolean;
  wireframe?: boolean;
  /** MeshStandardMaterial / MeshPhysicalMaterial */
  metalness?: number;
  /** MeshStandardMaterial / MeshPhysicalMaterial */
  roughness?: number;
  /** Hex emissive color */
  emissive?: string;
  emissiveIntensity?: number;
  /** Texture name or URL */
  map?: string;
  side?: MaterialSide;
}

// ─── Light ───────────────────────────────────────────────────────────────────

export interface SerializedLight {
  /** Hex color string */
  color: string;
  intensity: number;
  // PointLight / SpotLight
  distance?: number;
  decay?: number;
  // SpotLight
  /** Radians */
  angle?: number;
  /** 0–1 */
  penumbra?: number;
  // HemisphereLight
  /** Hex ground color */
  groundColor?: string;
  // RectAreaLight
  width?: number;
  height?: number;
}

// ─── Camera ──────────────────────────────────────────────────────────────────

export interface SerializedCamera {
  near: number;
  far: number;
  // PerspectiveCamera
  /** Vertical field of view in degrees */
  fov?: number;
  aspect?: number;
  // OrthographicCamera
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
  /** Three.js Object3D.type, e.g. 'Mesh', 'Group', 'DirectionalLight', 'PerspectiveCamera' */
  type: string;
  position: [number, number, number];
  /** Euler angles in radians, XYZ order */
  rotation: [number, number, number];
  scale: [number, number, number];
  visible: boolean;
  castShadow: boolean;
  receiveShadow: boolean;
  userData: Record<string, unknown>;
  children: SerializedNode[];
  // Present on Mesh / SkinnedMesh / Points / Line nodes
  geometry?: SerializedGeometry;
  /** Single material or multi-material array */
  material?: SerializedMaterial | SerializedMaterial[];
  // Present on light nodes (AmbientLight, DirectionalLight, PointLight, etc.)
  light?: SerializedLight;
  // Present on camera nodes (PerspectiveCamera, OrthographicCamera)
  camera?: SerializedCamera;
}

// ─── Add-object spec ─────────────────────────────────────────────────────────

export interface AddObjectGeometrySpec {
  type:
    | 'box' | 'sphere' | 'cylinder' | 'cone' | 'torus' | 'plane'
    | 'torusKnot' | 'icosahedron' | 'octahedron' | 'ring' | 'dodecahedron';
  /** Geometry constructor arguments, e.g. [1, 1, 1] for box w/h/d */
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
  /** Name or UUID of parent object; defaults to scene root */
  parent?: string;
  // Mesh-only
  geometry?: AddObjectGeometrySpec;
  material?: AddObjectMaterialSpec;
  // Light-only
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
  /** Unit vector pointing from `from` toward `to` */
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

// ─── WebSocket protocol ───────────────────────────────────────────────────────
//
// Every message carries a requestId so the other side can correlate
// responses to requests. The server sends commands; the client responds.

// Server → Client ─────────────────────────────────────────────────────────────

export interface GetSceneGraphMessage {
  type: 'get_scene_graph';
  requestId: string;
}

export interface GetObjectMessage {
  type: 'get_object';
  requestId: string;
  payload: {
    /** UUID or name of the object */
    id: string;
  };
}

export interface SetTransformMessage {
  type: 'set_transform';
  requestId: string;
  payload: {
    /** UUID or name of the object */
    id: string;
    position?: [number, number, number];
    /** Euler angles in radians */
    rotation?: [number, number, number];
    scale?: [number, number, number];
  };
}

export interface SetMaterialMessage {
  type: 'set_material';
  requestId: string;
  payload: {
    /** UUID or name of the object */
    id: string;
    /** CSS color string or hex, e.g. '#ff8800' or 'orange' */
    color?: string;
    roughness?: number;
    metalness?: number;
    /** 0–1 */
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
  payload: {
    /** UUID or name of the object */
    id: string;
    visible: boolean;
  };
}

export interface TakeScreenshotMessage {
  type: 'take_screenshot';
  requestId: string;
  payload: {
    width?: number;
    height?: number;
  };
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

// Client → Server ─────────────────────────────────────────────────────────────

export interface SceneGraphResponseMessage {
  type: 'scene_graph_response';
  requestId: string;
  payload: {
    /** Root Scene node with full subtree */
    scene: SerializedNode;
  };
}

export interface ObjectResponseMessage {
  type: 'object_response';
  requestId: string;
  payload: {
    /** null when no object matched the requested id */
    object: SerializedNode | null;
  };
}

export interface ScreenshotResponseMessage {
  type: 'screenshot_response';
  requestId: string;
  payload: {
    /** Raw base64-encoded PNG (no data-URL prefix) */
    image: string;
    width: number;
    height: number;
  };
}

export interface EditConfirmationMessage {
  type: 'edit_confirmation';
  requestId: string;
  payload: {
    /** UUID of the mutated object */
    id: string;
    /** Property or group that changed, e.g. 'position', 'material.color' */
    property: string;
    success: boolean;
  };
}

export interface ErrorMessage {
  type: 'error';
  requestId: string;
  payload: {
    message: string;
    /** Optional machine-readable code, e.g. 'OBJECT_NOT_FOUND' */
    code?: string;
  };
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

export type AnyMessage = ServerToClientMessage | ClientToServerMessage;

// ─── Connection status ────────────────────────────────────────────────────────

export type ConnectionStatus =
  | 'disconnected'
  | 'connecting'
  | 'connected'
  | 'reconnecting'
  | 'error';

// ─── Component props ─────────────────────────────────────────────────────────

/** Payload delivered to the onEdit callback after each successful mutation. */
export interface EditEvent {
  /** Message type that caused the edit: 'set_transform' | 'set_material' | 'set_visible' */
  type: string;
  /** UUID of the mutated object */
  target: string;
  /** The exact properties that were written (varies by edit type) */
  properties: Record<string, unknown>;
}

export interface MCPProviderProps {
  /** Port the MCP server's WebSocket is listening on. Default: 3333 */
  port?: number;
  /**
   * When true, write operations (set_transform, set_material, set_visible)
   * are rejected with a READ_ONLY error instead of being applied.
   * Default: false
   */
  readOnly?: boolean;
  /** Called after every successful mutation so users can sync React state. */
  onEdit?: (edit: EditEvent) => void;
  /**
   * Called on every connection lifecycle event so UI outside the Canvas can
   * display current status without needing a separate React context.
   */
  onStatus?: (status: ConnectionStatus, error?: Error) => void;
  /**
   * Allowlist of object names or Three.js type strings (e.g. 'Mesh', 'Group').
   * When provided, only matching objects (and ancestors needed to preserve
   * tree structure) are visible to the MCP tools.
   */
  include?: string[];
  /**
   * Denylist of object names or Three.js type strings.
   * Matching objects and their entire subtrees are hidden from MCP tools.
   * Takes priority over include.
   */
  exclude?: string[];
  /**
   * Reserved for a future JPEG-format option. Screenshots are currently always
   * saved as lossless PNG so this value has no effect.
   * Tip: set <Canvas gl={{ preserveDrawingBuffer: true }}> for reliable captures.
   */
  screenshotQuality?: number;
  children: ReactNode;
}
