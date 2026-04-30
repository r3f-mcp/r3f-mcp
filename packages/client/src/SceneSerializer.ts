import type {
  Object3D,
  Scene,
  Mesh,
  Light,
  SpotLight,
  PointLight,
  HemisphereLight,
  RectAreaLight,
  PerspectiveCamera,
  OrthographicCamera,
  Material,
  BufferGeometry,
  Color,
} from 'three';

// Value imports — constructors used in createObject / createGeometry / createMaterial.
// Three.js is a peer dep and is always present in the host app's bundle.
import {
  Group,
  Mesh         as MeshCtor,
  DirectionalLight,
  PointLight   as PointLightCtor,
  SpotLight    as SpotLightCtor,
  AmbientLight,
  BoxGeometry, SphereGeometry, CylinderGeometry, ConeGeometry,
  TorusGeometry, PlaneGeometry, TorusKnotGeometry, IcosahedronGeometry,
  OctahedronGeometry, RingGeometry, DodecahedronGeometry,
  MeshStandardMaterial, MeshBasicMaterial, MeshPhongMaterial,
  MeshLambertMaterial, MeshPhysicalMaterial,
  FrontSide, BackSide, DoubleSide,
} from 'three';

import type {
  SerializedNode,
  SerializedGeometry,
  SerializedMaterial,
  SerializedLight,
  MaterialSide,
  AddObjectPayload,
} from './types';

// ─── Internal augmented types ─────────────────────────────────────────────────
//
// Three.js's base Material / BufferGeometry types don't expose subclass-specific
// properties. We intersect with optional counterparts so TypeScript lets us read
// them safely, with explicit undefined checks at runtime before we use them.

type RichMaterial = Material & {
  color?: Color;
  emissive?: Color;
  emissiveIntensity?: number;
  wireframe?: boolean;
  metalness?: number;
  roughness?: number;
  /** Texture or null — only name/uuid are used */
  map?: { name: string; uuid: string } | null;
};

// Matches Mesh, SkinnedMesh, InstancedMesh, Points, Line, LineSegments, etc.
interface GeometryObject extends Object3D {
  geometry: BufferGeometry;
  material: Material | Material[];
}

// BufferGeometry subclasses store constructor args here, but the base type
// omits the field. We peel it off with a cast.
type GeometryWithParams = BufferGeometry & {
  parameters?: Record<string, number | boolean>;
};

// ─── Type guards (no instanceof — Three.js must stay a peer dep) ─────────────

// Cast through unknown to avoid the "no overlap" error that strict mode raises
// when casting a concrete class type to an index signature type directly.
function flag(obj: Object3D, key: string): boolean {
  return (obj as unknown as Record<string, unknown>)[key] === true;
}

function isMeshLike(obj: Object3D): obj is GeometryObject {
  return flag(obj, 'isMesh') || flag(obj, 'isPoints') || flag(obj, 'isLine');
}

function isLightObj(obj: Object3D): obj is Light {
  return flag(obj, 'isLight');
}

function isSpotLight(light: Light): light is SpotLight {
  return light.type === 'SpotLight';
}

function isPointLight(light: Light): light is PointLight {
  return light.type === 'PointLight';
}

function isHemisphereLight(light: Light): light is HemisphereLight {
  return light.type === 'HemisphereLight';
}

function isRectAreaLight(light: Light): light is RectAreaLight {
  return light.type === 'RectAreaLight';
}

function isPerspectiveCamera(obj: Object3D): obj is PerspectiveCamera {
  return flag(obj, 'isPerspectiveCamera');
}

function isOrthographicCamera(obj: Object3D): obj is OrthographicCamera {
  return flag(obj, 'isOrthographicCamera');
}

/** Objects that should be hidden from AI tools by default */
function isHelperObject(obj: Object3D): boolean {
  return obj.name.startsWith('__') || obj.type.includes('Helper');
}

// ─── Serialization helpers ────────────────────────────────────────────────────

function colorToHex(color: Color): string {
  return `#${color.getHexString()}`;
}

function sideToString(side: number): MaterialSide {
  if (side === 1) return 'BackSide';
  if (side === 2) return 'DoubleSide';
  return 'FrontSide';
}

function serializeGeometry(geometry: BufferGeometry): SerializedGeometry {
  const params = (geometry as GeometryWithParams).parameters;
  return {
    type: geometry.type,
    parameters: params ?? {},
  };
}

function serializeMaterial(material: Material): SerializedMaterial {
  const m = material as RichMaterial;

  const result: SerializedMaterial = {
    type: material.type,
    opacity: material.opacity,
    transparent: material.transparent,
    side: sideToString(material.side as number),
  };

  if (m.color !== undefined)            result.color            = colorToHex(m.color);
  if (m.emissive !== undefined)         result.emissive         = colorToHex(m.emissive);
  if (m.emissiveIntensity !== undefined) result.emissiveIntensity = m.emissiveIntensity;
  if (m.wireframe !== undefined)        result.wireframe        = m.wireframe;
  if (m.metalness !== undefined)        result.metalness        = m.metalness;
  if (m.roughness !== undefined)        result.roughness        = m.roughness;
  if (m.map != null)                    result.map              = m.map.name || m.map.uuid;

  return result;
}

function serializeLight(light: Light): SerializedLight {
  const result: SerializedLight = {
    color: colorToHex(light.color),
    intensity: light.intensity,
  };

  if (isSpotLight(light)) {
    result.distance = light.distance;
    result.decay    = light.decay;
    result.angle    = light.angle;
    result.penumbra = light.penumbra;
  } else if (isPointLight(light)) {
    result.distance = light.distance;
    result.decay    = light.decay;
  } else if (isHemisphereLight(light)) {
    result.groundColor = colorToHex(light.groundColor);
  } else if (isRectAreaLight(light)) {
    result.width  = light.width;
    result.height = light.height;
  }

  return result;
}

// ─── Public serialization API ─────────────────────────────────────────────────

/**
 * Recursively serialize a single Object3D and its subtree.
 *
 * @param includeHelpers - When false (default) objects whose name starts with
 *   "__" or whose type contains "Helper" are omitted from the output.
 */
export function serializeObject(object: Object3D, includeHelpers = false): SerializedNode {
  const name = object.name || `${object.type}_${object.uuid}`;

  const node: SerializedNode = {
    uuid: object.uuid,
    name,
    type: object.type,
    position:      object.position.toArray() as [number, number, number],
    rotation:      [object.rotation.x, object.rotation.y, object.rotation.z],
    scale:         object.scale.toArray() as [number, number, number],
    visible:       object.visible,
    castShadow:    object.castShadow,
    receiveShadow: object.receiveShadow,
    userData:      object.userData as Record<string, unknown>,
    children: object.children
      .filter(child => includeHelpers || !isHelperObject(child))
      .map(child => serializeObject(child, includeHelpers)),
  };

  if (isMeshLike(object)) {
    node.geometry = serializeGeometry(object.geometry);
    node.material = Array.isArray(object.material)
      ? object.material.map(serializeMaterial)
      : serializeMaterial(object.material);
  }

  if (isLightObj(object)) {
    node.light = serializeLight(object);
  } else if (isPerspectiveCamera(object)) {
    node.camera = {
      near:   object.near,
      far:    object.far,
      fov:    object.fov,
      aspect: object.aspect,
      zoom:   object.zoom,
    };
  } else if (isOrthographicCamera(object)) {
    node.camera = {
      near:   object.near,
      far:    object.far,
      left:   object.left,
      right:  object.right,
      top:    object.top,
      bottom: object.bottom,
      zoom:   object.zoom,
    };
  }

  return node;
}

/** Serialize the full scene tree starting from the Scene root. */
export function serializeScene(scene: Scene, includeHelpers = false): SerializedNode {
  return serializeObject(scene, includeHelpers);
}

// ─── Public mutation API ──────────────────────────────────────────────────────

/**
 * Find an object by UUID (tried first, exact match) or by name (first match
 * in a depth-first traversal). Returns null when nothing matches.
 */
export function findObject(scene: Scene, identifier: string): Object3D | null {
  return (
    scene.getObjectByProperty('uuid', identifier) ??
    scene.getObjectByName(identifier) ??
    null
  );
}

/**
 * Apply a partial transform to an object. Only the provided fields are
 * changed; omitting a field leaves that transform component untouched.
 */
export function applyTransform(
  object: Object3D,
  transform: Partial<{
    position: [number, number, number];
    rotation: [number, number, number];
    scale:    [number, number, number];
  }>,
): void {
  if (transform.position !== undefined) object.position.set(...transform.position);
  if (transform.rotation !== undefined) object.rotation.set(...transform.rotation);
  if (transform.scale    !== undefined) object.scale.set(...transform.scale);
}

/**
 * Apply material property overrides to every material on a Mesh.
 * Only provided keys are changed; the rest are left untouched.
 * Three.js accepts any CSS color string or hex value for color fields.
 */
export function applyMaterial(
  object: Mesh,
  properties: Partial<{
    color:             string;
    opacity:           number;
    transparent:       boolean;
    metalness:         number;
    roughness:         number;
    wireframe:         boolean;
    emissive:          string;
    emissiveIntensity: number;
  }>,
): void {
  const materials = Array.isArray(object.material)
    ? object.material
    : [object.material];

  for (const mat of materials) {
    const m = mat as RichMaterial;

    // Color fields: delegate to Color.set() which accepts any CSS / hex string.
    if (properties.color             !== undefined) m.color?.set(properties.color);
    if (properties.emissive          !== undefined) m.emissive?.set(properties.emissive);
    if (properties.emissiveIntensity !== undefined) m.emissiveIntensity = properties.emissiveIntensity;

    // Scalar / boolean fields available on the base Material class.
    if (properties.opacity     !== undefined) mat.opacity     = properties.opacity;
    if (properties.transparent !== undefined) mat.transparent = properties.transparent;

    // Subclass-specific fields — silently ignored on materials that lack them.
    if (properties.metalness  !== undefined) m.metalness  = properties.metalness;
    if (properties.roughness  !== undefined) m.roughness  = properties.roughness;
    if (properties.wireframe  !== undefined) m.wireframe  = properties.wireframe;

    // Signal Three.js to recompile the shader if structural properties changed
    // (e.g. transparent toggled, new map assigned).
    mat.needsUpdate = true;
  }
}

// ─── Imperative object creation ───────────────────────────────────────────────

/**
 * Create a Three.js object from an `AddObjectPayload` spec, attach it to the
 * given parent (or scene root), and return it.
 *
 * This bypasses React's reconciler — call `invalidate()` afterward and fire the
 * `onEdit` callback so the host app can optionally sync its own state.
 */
export function createObject(
  payload: AddObjectPayload,
  parent: Object3D,
): Object3D {
  const {
    name,
    type,
    position = [0, 0, 0],
    rotation = [0, 0, 0],
    scale    = [1, 1, 1],
    geometry: geoSpec,
    material: matSpec,
    color,
    intensity,
    distance,
    angle,
    penumbra,
    castShadow,
  } = payload;

  let object: Object3D;

  switch (type) {
    case 'mesh': {
      const geo = buildGeometry(geoSpec);
      const mat = buildMaterial(matSpec);
      object = new MeshCtor(geo, mat);
      break;
    }
    case 'group':
      object = new Group();
      break;
    case 'directionalLight': {
      const dl = new DirectionalLight(color ?? '#ffffff', intensity ?? 1);
      if (castShadow !== undefined) dl.castShadow = castShadow;
      object = dl;
      break;
    }
    case 'pointLight': {
      const pl = new PointLightCtor(color ?? '#ffffff', intensity ?? 1, distance);
      if (castShadow !== undefined) pl.castShadow = castShadow;
      object = pl;
      break;
    }
    case 'spotLight': {
      const sl = new SpotLightCtor(color ?? '#ffffff', intensity ?? 1, distance);
      if (angle    !== undefined) sl.angle    = angle;
      if (penumbra !== undefined) sl.penumbra = penumbra;
      if (castShadow !== undefined) sl.castShadow = castShadow;
      object = sl;
      break;
    }
    case 'ambientLight':
      object = new AmbientLight(color ?? '#ffffff', intensity ?? 1);
      break;
    default: {
      const _: never = type;
      throw new Error(`Unknown object type: ${_}`);
    }
  }

  object.name = name;
  object.position.set(...position);
  object.rotation.set(...rotation);
  object.scale.set(...scale);

  parent.add(object);
  return object;
}

function buildGeometry(spec: AddObjectPayload['geometry']): BufferGeometry {
  if (!spec) return new BoxGeometry(1, 1, 1);
  const a = spec.args ?? [];
  // Destructure with undefined fallbacks — Three.js constructors accept optional numbers.
  const [a0, a1, a2, a3, a4, a5] = a;
  switch (spec.type) {
    case 'box':        return new BoxGeometry(a0, a1, a2, a3, a4, a5);
    case 'sphere':     return new SphereGeometry(a0, a1, a2);
    case 'cylinder':   return new CylinderGeometry(a0, a1, a2, a3);
    case 'cone':       return new ConeGeometry(a0, a1, a2, a3);
    case 'torus':      return new TorusGeometry(a0, a1, a2, a3);
    case 'plane':      return new PlaneGeometry(a0, a1, a2, a3);
    case 'torusKnot':  return new TorusKnotGeometry(a0, a1, a2, a3, a4, a5);
    case 'icosahedron':  return new IcosahedronGeometry(a0, a1);
    case 'octahedron':   return new OctahedronGeometry(a0, a1);
    case 'ring':         return new RingGeometry(a0, a1, a2, a3);
    case 'dodecahedron': return new DodecahedronGeometry(a0, a1);
    default: {
      const _: never = spec.type;
      return new BoxGeometry(1, 1, 1); // unreachable
      void _;
    }
  }
}

function buildMaterial(spec: AddObjectPayload['material']): Material {
  const matType = spec?.type ?? 'standard';
  let mat: Material;
  switch (matType) {
    case 'basic':    mat = new MeshBasicMaterial(); break;
    case 'phong':    mat = new MeshPhongMaterial(); break;
    case 'lambert':  mat = new MeshLambertMaterial(); break;
    case 'physical': mat = new MeshPhysicalMaterial(); break;
    default:         mat = new MeshStandardMaterial(); break;
  }
  if (!spec) return mat;

  const m = mat as RichMaterial;
  if (spec.color       && m.color)    m.color.set(spec.color);
  if (spec.opacity     !== undefined) mat.opacity     = spec.opacity;
  if (spec.transparent !== undefined) mat.transparent = spec.transparent;
  if (spec.metalness   !== undefined) m.metalness     = spec.metalness;
  if (spec.roughness   !== undefined) m.roughness     = spec.roughness;
  if (spec.wireframe   !== undefined) m.wireframe     = spec.wireframe;
  if (spec.side === 'back')   mat.side = BackSide;
  else if (spec.side === 'double') mat.side = DoubleSide;
  else if (spec.side === 'front')  mat.side = FrontSide;

  return mat;
}

/**
 * Recursively dispose a Three.js object's geometry and materials, then remove
 * it from its parent. Returns false if the object is protected (scene root or
 * a camera), true on success.
 */
export function destroyObject(object: Object3D): boolean {
  const isScene  = object.type === 'Scene';
  const isCamera = (object as unknown as Record<string, unknown>)['isCamera'] === true;
  if (isScene || isCamera) return false;

  // Dispose depth-first so children are cleaned up before the parent.
  for (const child of [...object.children]) {
    destroyObjectRecursive(child);
  }
  disposeResources(object);
  object.parent?.remove(object);
  return true;
}

function destroyObjectRecursive(object: Object3D): void {
  for (const child of [...object.children]) {
    destroyObjectRecursive(child);
  }
  disposeResources(object);
}

function disposeResources(object: Object3D): void {
  const obj = object as unknown as Record<string, unknown>;
  const geo = obj['geometry'];
  if (geo && typeof (geo as { dispose?: () => void }).dispose === 'function') {
    (geo as { dispose: () => void }).dispose();
  }
  const mat = obj['material'];
  if (mat) {
    const mats = Array.isArray(mat) ? mat : [mat];
    for (const m of mats as Array<{ dispose?: () => void }>) {
      if (typeof m.dispose === 'function') m.dispose();
    }
  }
}
