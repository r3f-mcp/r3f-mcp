import { z } from 'zod';
import type { Tool } from '@modelcontextprotocol/sdk/types.js';

// ─── Schema ───────────────────────────────────────────────────────────────────

const VALID_TOPICS = [
  // Core knowledge (v0.4.1)
  'materials', 'lighting', 'animation', 'post-processing', 'camera',
  'physics', 'particles', 'text', 'shaders', 'performance',
  'composition', 'interactivity', 'audio', 'environment', 'scenes',
  // New topics (v0.4.4)
  'architecture', 'scroll', 'models', 'libraries', 'effects', 'heuristics', 'webgpu',
] as const;

export const r3fReferenceSchema = z.object({
  topics: z.array(z.enum(VALID_TOPICS))
    .min(1)
    .describe('Topics to fetch reference for'),
});
export type R3FReferenceInput = z.infer<typeof r3fReferenceSchema>;

// ─── Tool definition ──────────────────────────────────────────────────────────

export const r3fReferenceTool: Tool = {
  name: 'r3f_reference',
  description:
    'Get expert-level best practices, recipes, and API references for React Three Fiber. ' +
    'Call this BEFORE generating any component for professional-quality output. ' +
    'Topics: materials, lighting, animation, post-processing, camera, physics, particles, ' +
    'text, shaders, performance, composition, interactivity, audio, environment, scenes, ' +
    'architecture, scroll, models, libraries, effects, heuristics, webgpu. ' +
    'Use "heuristics" for MCP-specific generation defaults. ' +
    'Use "scenes" for environment profiles. ' +
    'Use "effects" for 30+ creative effect recipes. ' +
    'This is embedded expert knowledge — no internet fetch required.',
  inputSchema: {
    type: 'object',
    properties: {
      topics: {
        type: 'array',
        items: { type: 'string', enum: [...VALID_TOPICS] },
        description: 'One or more topics to fetch guidance for',
        minItems: 1,
      },
    },
    required: ['topics'],
  },
};

// ─── Knowledge base ───────────────────────────────────────────────────────────

const KNOWLEDGE: Record<typeof VALID_TOPICS[number], string> = {

  materials: `
MATERIALS BEST PRACTICES FOR R3F:

Golden rule: Never use meshBasicMaterial for visible lit objects. Default to meshStandardMaterial.

CINEMATIC MATERIAL TABLE:
| Effect           | Material                    | Critical props                                              |
|------------------|-----------------------------|-------------------------------------------------------------|
| Realistic glass  | MeshTransmissionMaterial    | transmission=1, thickness, chromaticAberration, samples=10  |
| Frosted glass    | MeshTransmissionMaterial    | roughness=0.4, reduce samples for perf                      |
| Mirror floor     | MeshReflectorMaterial       | mixStrength, mixContrast, blur=[300,100], mixBlur           |
| Diamond/gem      | MeshRefractionMaterial      | bounces=3, aberrationStrength, use HDRI env                 |
| Toon outline     | <Outlines thickness color>  | child of mesh                                               |
| Goo/metaballs    | <MarchingCubes>             | resolution 28-48, MeshTransmissionMaterial                  |
| Procedural blob  | MeshDistortMaterial         | distort, speed, radius                                      |
| Vertex wave      | MeshWobbleMaterial          | factor, speed                                               |
| Decal sticker    | <Decal map position scale>  | applied to GLTF meshes                                      |

PRO SETUPS:

1. Realistic metal
   <meshStandardMaterial color="#888" metalness={1} roughness={0.2} envMapIntensity={1} />
   Pair with <Environment /> — without env map, metals look flat.

2. Glass/crystal (prefer MeshTransmissionMaterial from drei):
   <MeshTransmissionMaterial transmission={1} thickness={0.5}
     chromaticAberration={0.06} distortion={0.2} temporalDistortion={0.1}
     roughness={0} samples={10} resolution={512} />
   Far superior to transparent + meshPhysicalMaterial.

3. Emissive glow:
   <meshStandardMaterial color="#ff6600" emissive="#ff6600" emissiveIntensity={2} />
   Set material color ABOVE 1.0 (e.g. color={[5, 2, 0]}) to feed selective Bloom.

4. Holographic sheen:
   Custom shader: fresnel (pow(1-dot(viewDir, normal), 3)) + scrolling iridescent gradient.

Tips:
- Transparency causes draw-order issues. Use alphaTest for cutouts, transparency only for true translucency.
- <Environment /> is required for metallic/transmission materials to look correct.
- InstancedMesh shares one material across thousands of instances — never create per-instance materials.
`.trim(),

  lighting: `
LIGHTING BEST PRACTICES FOR R3F:

GOLDEN RULE: Add <Environment preset="studio" /> first. Single highest-impact quality improvement.

THREE LIGHTS MAX rule for real-time:
  1. Directional (sun) with shadows.
  2. Ambient or hemisphere fill — keep intensity LOW (0.1-0.3).
  3. One accent point/spot.
  Anything beyond → bake or use an HDRI.

SHADOW TIERS (cheapest to richest):
  1. <ContactShadows>                  — fast fake blob (no mesh shadow).
  2. <SoftShadows samples={10} size={25}> — PCSS, replaces default sharp shadows.
  3. <AccumulativeShadows> + <RandomizedLight> — temporal accumulation, baked quality.
  4. Cascaded Shadow Maps (CSM addon)   — for sprawling outdoor scenes.
  5. Pre-baked lightmaps (@react-three/lightmap).
  <BakeShadows /> freezes shadow maps after first render for static scenes.

STYLIZED RIM WITH LIGHTFORMERS (product shot gold standard):
  <Environment background={false}>
    <Lightformer position={[5, 5, -5]} scale={[10, 5, 1]} intensity={2} color="#ff8866" />
    <Lightformer position={[-5, 0, 0]} scale={[1, 10, 1]} intensity={1} color="#88aaff" />
  </Environment>

ENVIRONMENT PRESETS (drei):
  "studio"     soft neutral — products   "city"      urban HDR — reflections
  "sunset"     warm golden hour          "dawn"      pink/blue
  "night"      dark with accents         "forest"    green-tinted natural
  "apartment"  warm interior             "park"      bright daylight
  "warehouse"  industrial                "lobby"     soft architectural

Shadow setup for directional light quality:
  <directionalLight castShadow
    shadow-mapSize-width={2048} shadow-mapSize-height={2048}
    shadow-camera-far={50} shadow-bias={-0.0001} />
`.trim(),

  animation: `
ANIMATION BEST PRACTICES FOR R3F:

PATTERN INDEX:
| Need                  | Tool                                         |
|-----------------------|----------------------------------------------|
| Rotate/translate loop | useFrame + ref mutation                      |
| Springy hover/click   | @react-spring/three useSpring                |
| Declarative variants  | framer-motion-3d <motion.mesh>               |
| Keyframed cinematic   | Theatre.js useCurrentSheet + seek()          |
| Scroll-locked         | GSAP timeline + useScroll().offset + seek()  |
| GLTF animations       | useAnimations(animations, ref) from drei     |
| Morph targets         | mesh.morphTargetInfluences[i] in useFrame    |
| Frame-rate-safe lerp  | maath/easing damp / damp3 / dampE            |

ALWAYS USE DELTA for frame-rate independence:
  useFrame((state, delta) => {
    meshRef.current.rotation.y += delta * speed;
    // NOT: rotation.y += 0.01  (frame-rate dependent!)
  });

SMOOTH LERP WITH MAATH (preferred over manual lerp):
  import { damp, damp3, dampE } from 'maath/easing'
  useFrame((state, delta) => {
    damp3(meshRef.current.position, targetPos, 0.1, delta)  // smooth 3D follow
    damp(meshRef.current.scale, targetScale, 0.05, delta)   // smooth scalar
    dampE(meshRef.current.rotation, targetEuler, 0.1, delta) // smooth rotation
  })

ORGANIC MOTION — use different frequencies per axis:
  const t = state.clock.elapsedTime;
  mesh.position.y = Math.sin(t * 0.7) * 0.2 + base;
  mesh.rotation.x = Math.sin(t * 0.3) * 0.1;
  mesh.rotation.z = Math.cos(t * 0.2) * 0.05;
  // Same frequency on all axes = mechanical. Primes (0.7, 1.3, 0.97) = organic.

GSAP SCROLL TIMELINE (the canonical pattern):
  const tl = useRef()
  const scroll = useScroll()
  useLayoutEffect(() => {
    tl.current = gsap.timeline()
    tl.current.to(ref.current.position, { y: -5, duration: 2 }, 0)
    tl.current.to(ref.current.rotation, { y: Math.PI, duration: 1 }, 1)
  }, [])
  useFrame(() => tl.current.seek(scroll.offset * tl.current.duration()))

DREI FLOAT for easy bobbing:
  <Float speed={1.5} rotationIntensity={0.5} floatIntensity={0.5}>
    <mesh />
  </Float>
`.trim(),

  'post-processing': `
POST-PROCESSING FOR R3F (v3+, @react-three/postprocessing):

SETUP: Always wrap in <EffectComposer>. Order matters — ToneMapping goes LAST.
  <Canvas gl={{ antialias: false }}>  // let SMAA handle AA instead
  <EffectComposer>
    <Bloom luminanceThreshold={1} luminanceSmoothing={0.9} intensity={1} mipmapBlur />
    <Vignette offset={0.1} darkness={1.1} />
    <ToneMapping mode={ToneMappingMode.ACES_FILMIC} />
  </EffectComposer>

SELECTIVE BLOOM (the correct approach):
  luminanceThreshold={1} means only pixels > 1.0 brightness bloom.
  Lift material colors: color={[5, 2, 0]} on meshBasicMaterial instead of color="#ff4400".
  This makes specific objects glow without blowing out the whole scene.

EFFECT REFERENCE:
  <Bloom luminanceThreshold intensity mipmapBlur>        — selective glow
  <DepthOfField focusDistance focalLength bokehScale>    — cinematic bokeh
  <GodRays sun={meshRef} samples={60} density={0.96}>   — sun ref = a mesh
  <SSAO>                                                  — ambient occlusion (legacy)
  <N8AO>                                                  — modern fast AO
  <SSR>                                                   — screen-space reflections (heavy)
  <Vignette offset darkness>                              — corner darkening
  <ChromaticAberration offset={[0.002, 0.002]}>          — lens fringing
  <Noise opacity={0.025}>                                 — film grain
  <Glitch delay strength>                                 — digital glitch
  <Pixelation granularity={6}>                            — retro pixel look
  <Outline>                                               — mesh outline highlight
  <ToneMapping mode={ToneMappingMode.ACES_FILMIC}>       — ALWAYS LAST

TONE MAPPING MODES: ACES_FILMIC (cinematic, default), AGX (new photorealistic), NEUTRAL, REINHARD.

CINEMATIC STACKS:
  Clean product:   ToneMapping + SMAA
  Dramatic:        Bloom (threshold 0.8) + Vignette + ChromaticAberration + ToneMapping
  Neon/cyberpunk:  Bloom (threshold 0.05, intensity 2) + ToneMapping (use color={[5,0,10]} materials)
  Dreamy:          Bloom + DepthOfField + ToneMapping
  Film:            Noise + Vignette + ChromaticAberration + ToneMapping

CUSTOM EFFECT: Subclass Effect from 'postprocessing' with a fragment shader, wrap in forwardRef component.
`.trim(),

  camera: `
CAMERA BEST PRACTICES FOR R3F:

CAMERA POSITION PRESETS:
  Product showcase:    [0, 1, 5]   fov 40    (low fov = less distortion)
  Interior eye-level:  [0, 1.6, 5] fov 60
  Overview/dramatic:   [0, 8, 12]  fov 65
  Abstract/hero:       [0, 0, 10]  fov 60
  Cinematic widescreen:[0, 2, 8]   fov 35

CONTROLS TAXONOMY (drei):
  <OrbitControls>           — free orbit (most common)
  <CameraControls>          — camera-controls lib, smooth interpolation, more features
  <PresentationControls>    — bounded rotation for product showcase
  <ScrollControls pages={3}> + useScroll() — DOM-scroll-driven camera
  <MotionPathControls>      — camera follows a Catmull-Rom spline
  <PointerLockControls>     — FPS first-person
  <FlyControls>             — free flight
  <KeyboardControls map>    — WASD game inputs

SCROLL CAMERA PATTERN:
  const scroll = useScroll()
  useFrame(({ camera }) => {
    camera.position.z = 5 - scroll.offset * 3
    camera.lookAt(0, scroll.offset * 2, 0)
  })

SMOOTH ANIMATED CAMERA:
  useFrame(({ camera }) => {
    camera.position.lerp(targetPos, 0.05)   // slow = 0.02, fast = 0.1
    camera.lookAt(focusTarget)
  })

TIPS:
  - <PerspectiveCamera makeDefault> declares camera declaratively — use makeDefault to attach controls.
  - fov 35-50 for products/archviz, 60-75 for general, 80-90 for games/immersive.
  - <CubeCamera> for dynamic env maps on reflective surfaces.
  - <CameraShake intensity={0.5}> from drei adds subtle film-like micro-jitter.
`.trim(),

  physics: `
PHYSICS WITH @react-three/rapier (v2+, React 19, fiber v9):

BASIC SETUP:
  <Physics gravity={[0, -9.81, 0]}>
    <RigidBody colliders='hull' restitution={0.4}>
      <Suzanne />
    </RigidBody>
    <CuboidCollider args={[20, 0.5, 20]} position={[0, -2, 0]} />
  </Physics>

COLLIDER TYPES: hull, trimesh, cuboid, ball, capsule, cone, cylinder.
  Auto-generated from geometry by default. Explicit colliders are faster.

BODY TYPES:
  type="dynamic"           — full physics (default)
  type="fixed"             — immovable (floors, walls)
  type="kinematicPosition" — position-controlled (animated platforms)

INSTANCED PHYSICS (thousands of rigid bodies):
  <InstancedRigidBodies positions={…} rotations={…}>
    <instancedMesh args={[geo, mat, count]}>
      …
    </instancedMesh>
  </InstancedRigidBodies>

JOINTS: useFixedJoint, useSphericalJoint, useRevoluteJoint, usePrismaticJoint

APPLY IMPULSE ON CLICK:
  const rbRef = useRef()
  onClick={() => rbRef.current.applyImpulse({ x: 0, y: 10, z: 0 }, true)
  rbRef.current.applyTorqueImpulse({ x: 0, y: Math.random(), z: 0 }, true)

CHARACTER CONTROLLER (ecctrl):
  import { Ecctrl, EcctrlAnimation } from 'ecctrl'
  <Ecctrl jumpVel={5} maxVelLimit={10}>
    <Suzanne />
  </Ecctrl>
  Drop-in third-person capsule character with WASD, jump, run, double-jump, follow camera.

SENSORS (trigger volumes):
  <RigidBody type="fixed" sensor
    onIntersectionEnter={({ other }) => console.log('entered!', other.rigidBodyObject?.name)}>
    <BallCollider args={[3]} />
  </RigidBody>

REGISTER WITH MCP: Call useRegisterPhysics(world) from useRapier() inside your <Physics> provider
to enable the get_physics MCP tool.
`.trim(),

  particles: `
PARTICLES BEST PRACTICES FOR R3F:

THREE APPROACHES (by scale):

1. CPU ATTRIBUTES (<10k particles):
   const positions = useMemo(() => new Float32Array(count * 3).fill(0).map(() => (Math.random()-0.5)*20), [])
   <points>
     <bufferGeometry>
       <bufferAttribute attach="attributes-position" count={count} array={positions} itemSize={3} />
     </bufferGeometry>
     <pointsMaterial size={0.05} sizeAttenuation transparent blending={THREE.AdditiveBlending} depthWrite={false} />
   </points>
   Update per-frame: geometry.attributes.position.needsUpdate = true

2. INSTANCED MESH (100k+ identical objects):
   const dummy = useMemo(() => new THREE.Object3D(), [])
   useFrame(({ clock }) => {
     particles.forEach((p, i) => {
       dummy.position.set(p.x, p.y + Math.sin(clock.elapsedTime * p.speed) * 0.3, p.z)
       dummy.updateMatrix()
       ref.current.setMatrixAt(i, dummy.matrix)
     })
     ref.current.instanceMatrix.needsUpdate = true
   })
   <instancedMesh ref={ref} args={[undefined, undefined, count]}>
     <sphereGeometry args={[0.05, 6, 6]} />  {/* low poly for small objects! */}
     <meshStandardMaterial color="#88aaff" emissive="#88aaff" emissiveIntensity={0.5} />
   </instancedMesh>

3. GPGPU / FBO PING-PONG (1M+ particles):
   - Store positions/velocities in floating-point textures.
   - Evolve via simulationMaterial fragment shader each frame.
   - Sample output texture in vertex shader to place particles.
   - useFBO() from drei for render targets.

VFX ENGINES (ready-made):
  wawa-vfx:    <VFXParticles> + <VFXEmitter> — GPU-accelerated, billboard or mesh.
  three.quarks + quarks.r3f — Unity-shuriken emitters: SizeOverLife, ColorOverLife, PiecewiseBezier.

TRAILS:
  Drei <Trail width={2} length={10} color="#fff"> — quick mesh trail behind any object.
  MeshLineGeometry + MeshLineMaterial from 'meshline' — variable-width billboarded line with widthCallback.

SPARKLES (quick magic dust):
  <Sparkles count={50} scale={5} size={6} speed={0.4} color="#fff" />

TIPS:
  - Low-poly instances: sphereGeometry args [r, 6, 6] never [r, 32, 32] for small particles.
  - Additive blending: blending={THREE.AdditiveBlending} depthWrite={false} for glowing particles.
  - Randomize: size, speed, starting phase, color hue — identical particles look wrong.
`.trim(),

  text: `
3D TEXT IN R3F:

1. SDF text (best quality, all sizes):
   import { Text } from '@react-three/drei'
   <Text fontSize={0.5} color="#ffffff" anchorX="center" anchorY="middle"
     font="/fonts/Inter-Bold.woff" sdfGlyphSize={64}>
     Hello World
   </Text>
   Powered by troika-three-text. Supports wrapping, alignment, letterSpacing.

2. Extruded 3D text:
   import { Text3D, Center } from '@react-three/drei'
   <Center>
     <Text3D font="/fonts/helvetiker_regular.typeface.json"
       size={1} height={0.2} curveSegments={12}
       bevelEnabled bevelThickness={0.02} bevelSize={0.02}>
       R3F
       <meshStandardMaterial color="#fff" metalness={0.5} roughness={0.2} />
     </Text3D>
   </Center>
   Always wrap in <Center> — Text3D is left-aligned at origin.
   Fonts: download typeface.json from drei or convert with facetype.js.

3. Billboard label (always faces camera):
   <Billboard>
     <Text fontSize={0.2}>Label</Text>
   </Billboard>

4. HTML overlay on 3D point:
   import { Html } from '@react-three/drei'
   <Html position={[0, 2, 0]} center occlude distanceFactor={10}>
     <div style={{ color: 'white', background: 'rgba(0,0,0,0.7)', padding: '4px 8px', borderRadius: 4 }}>
       Interactive tooltip
     </div>
   </Html>
   occlude={true} hides the element behind meshes. distanceFactor scales by depth.

TIPS:
  - <Text> (2D sprite) is far cheaper than Text3D for many labels.
  - Use Html for rich interactive overlays with React state, buttons, inputs.
  - <ScreenSpace> / <ScreenSizer> for fixed HUD overlays that ignore camera transform.
`.trim(),

  shaders: `
CUSTOM SHADERS FOR R3F:

SHADERMATTEIAL PATTERN (canonical):
  import { shaderMaterial } from '@react-three/drei'
  import { extend, useFrame } from '@react-three/fiber'
  import * as THREE from 'three'

  const WaveMaterial = shaderMaterial(
    { uTime: 0, uColor: new THREE.Color('#ff6600'), uMouse: new THREE.Vector2() },
    /* vertex */
    \`varying vec2 vUv;
    void main() {
      vUv = uv;
      vec3 pos = position;
      pos.z += sin(pos.x * 5.0 + uTime) * 0.1;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
    }\`,
    /* fragment */
    \`uniform float uTime; uniform vec3 uColor; varying vec2 vUv;
    void main() {
      float s = sin(vUv.x * 10.0 + uTime) * 0.5 + 0.5;
      gl_FragColor = vec4(uColor * s, 1.0);
    }\`
  )
  extend({ WaveMaterial })

  function Mesh() {
    const ref = useRef()
    useFrame((state, dt) => { ref.current.uTime += dt })
    return <mesh><planeGeometry args={[2, 2, 64, 64]} /><waveMaterial ref={ref} /></mesh>
  }

ESSENTIAL PATTERNS:
  Fresnel:        pow(1.0 - dot(viewDir, normal), 3.0)
  FBM:            4-6 octaves of simplex noise, growing frequency, shrinking amplitude
  Curl noise:     divergence-free 3D noise for swirling particle flows
  Mask reveal:    step(noise(uv), uProgress) driven 0→1 by GSAP
  Dispersion:     refract per RGB channel with slightly different IORs
  Vertex wave:    pos.z += sin(uv.x * 10.0 + uTime) * amplitude
  Topography:     floor(noise * 10.0) / 10.0 for contour bands

MODULAR GLSL:
  glslify + babel-plugin-glsl: #pragma glslify: snoise = require('glsl-noise/simplex/3d')
  Lygia (resolve-lygia): #include "lygia/generative/pnoise.glsl" — massive function library

SHADERTOY PORTING:
  Map: iTime → uTime, iResolution → uResolution, iMouse → uMouse, iChannel0 → uMap
  Replace mainImage(out fragColor, in fragCoord) with standard void main()
  Use gl_FragCoord and gl_FragColor. Feed through <ScreenQuad> for fullscreen effects.

TSL (Three Shader Language, the future — see 'webgpu' topic):
  Compiles to WGSL (WebGPU) and GLSL (WebGL). Import from 'three/tsl'.
  mat.colorNode = color(1, 0, 0).mul(sin(time).mul(0.5).add(0.5))

ON-BEFORE-COMPILE (extend existing materials):
  material.onBeforeCompile = (shader) => {
    shader.uniforms.uTime = { value: 0 }
    shader.vertexShader = 'uniform float uTime;\n' + shader.vertexShader.replace('#include <begin_vertex>', '…')
  }
  Lets you add displacement/color without losing PBR lighting.
`.trim(),

  performance: `
PERFORMANCE PLAYBOOK FOR R3F:

FRAME LOOP:
  <Canvas frameloop='demand'> — render only when invalidate() is called. Best for static/interactive scenes.
  <Canvas frameloop='always'> — default, continuous 60fps render loop.
  <Canvas frameloop='never'> — fully manual via gl.render(scene, camera).

DRAW CALLS — target <100/frame:
  Check: renderer.info.render.calls (or r3f-perf overlay)
  <InstancedMesh> / drei <Instances> — 1 draw call for thousands of same geometry.
  BatchedMesh (r156+) — varied geometries sharing a material.
  mergeGeometries (BufferGeometryUtils) — static scenery into one mesh.

USEFRAME DISCIPLINE:
  MUTATE REFS not state: meshRef.current.position.x += delta * speed
  NEVER ALLOCATE inside loop: not new THREE.Vector3() — hoist to useMemo or module scope
  ALWAYS USE DELTA: rotation.y += speed * delta (not += 0.01)
  Subscribe selectors: useStore(state => state.x) not useStore() to avoid full re-renders

MEMORY HYGIENE:
  Dispose on unmount: geo.dispose(), mat.dispose(), tex.dispose(), renderTarget.dispose()
  ImageBitmap: texture.source.data.close?.()
  Object pool for spawn-heavy systems (bullets, particles).
  Cache textures: const cache = new Map(); if (!cache.has(url)) cache.set(url, loader.load(url))

ADAPTIVE QUALITY:
  <AdaptiveDpr pixelated /> — drops devicePixelRatio on performance regress.
  <AdaptiveEvents /> — disables raycasting on regress.
  <PerformanceMonitor onDecline={() => setQuality('low')} onIncline={() => setQuality('high')}>

SHADER MICRO-OPTS:
  precision mediump float; — ~2x faster than highp on mobile GPU.
  Replace if/else with mix(a, b, step(t, x)).
  Minimize varyings (<3 ideal); pack into vec4s.
  Pack 4 scalars into one RGBA data texture.
  Avoid dynamic loops; unroll short ones.

RAYCASTING:
  <Bvh> — wraps three-mesh-bvh, ~100x faster raycasting on large meshes.
  Set raycast={null} on non-interactive meshes.
  Layers to exclude objects from raycasting.

LOD:
  <Detailed distances={[0, 25, 100]}>
    <HighPolyMesh /><MedPolyMesh /><LowPolyMesh />
  </Detailed>

TOOLS:
  r3f-perf — overlay with shaders, draw calls, vertices, GPU timing.
  stats-gl / stats.js — frame timing.
  Spector.js — captures/replays a single frame, lists every WebGL call.
  renderer.info — programmatic counts.
`.trim(),

  composition: `
SCENE COMPOSITION BEST PRACTICES (unchanged from photography/film):

RULE OF THIRDS: Don't center everything. Place subjects at 1/3 or 2/3 screen positions.

DEPTH LAYERING — always have foreground, midground, background:
  Near:     close objects, possibly blurred with DepthOfField
  Middle:   main subject
  Far:      environment, skybox, fog

GROUND PLANE — almost every non-space/abstract scene needs one as visual anchor.

FOG adds depth — always match fog color exactly to background:
  <fog attach="fog" args={[bgColor, near, far]} />         // linear
  <fogExp2 attach="fog" args={[bgColor, 0.05]} />          // exponential (more natural)

CAMERA HEIGHT SEMANTICS:
  y: 8-15     authority / overview / god view
  y: 1.6      eye level / intimacy / human scale
  y: 0.5      dramatic low angle / vulnerability

SCALE: 1 unit = 1 meter. Keeps lighting, physics, and shadows behaving predictably.

COLOR PALETTE: Maximum 2-3 main colors + neutrals. Use HSL for easy harmony.
  - Analogous: hues within 30° of each other (calm, cohesive)
  - Complementary: opposite hues (high contrast, dynamic)
  - Triadic: 120° apart (vibrant, complex)

NEGATIVE SPACE: Don't fill every corner. Empty space draws focus to what's there.

ATMOSPHERE ADDITIONS:
  <Stars radius={100} depth={50} count={5000} factor={4} />   (drei)
  <Clouds />                                                    (drei)
  <Sky sunPosition={[100, 20, 100]} />                         (drei)
  <Backdrop>                                                    (infinite cyclorama)
  <fog attach="fog" args={[color, near, far]} />

DEPTH OF FIELD for cinematic focus:
  <DepthOfField focusDistance={0.01} focalLength={0.02} bokehScale={3} />
`.trim(),

  interactivity: `
INTERACTIVITY BEST PRACTICES FOR R3F:

HOVER WITH SPRING (the professional standard):
  import { useSpring, animated } from '@react-spring/three'
  const [hovered, setHovered] = useState(false)
  const { scale } = useSpring({ scale: hovered ? 1.15 : 1, config: { tension: 200, friction: 20 } })
  <animated.mesh scale={scale}
    onPointerOver={() => { setHovered(true); document.body.style.cursor = 'pointer' }}
    onPointerOut={()  => { setHovered(false); document.body.style.cursor = 'default' }}
  />

CLICK WITH PROPAGATION GUARD:
  <mesh onClick={(e) => { e.stopPropagation(); handleClick() }} />
  Always stopPropagation() to prevent click-through to objects behind.

DRAG (use-gesture):
  import { useDrag } from '@use-gesture/react'
  const [pos, setPos] = useState([0, 0, 0])
  const bind = useDrag(({ offset: [x, y] }) => setPos([x/100, -y/100, 0]))
  <mesh {...bind()} position={pos} />

RAYCASTING PERFORMANCE:
  <Bvh> — 100x faster raycasting on complex meshes.
  raycast={null} on non-interactive objects.
  layers to exclude objects from ray tests.

HTML TOOLTIPS ON 3D:
  <Html position={[0, 1.5, 0]} center occlude distanceFactor={10}>
    <div style={{ pointerEvents: 'auto' }}>Clickable HTML</div>
  </Html>

SELECTION HIGHLIGHT:
  import { Select, Selection } from '@react-three/postprocessing'
  <Selection>
    <EffectComposer><Outline visibleEdgeColor="white" edgeStrength={3} /></EffectComposer>
    <Select enabled={hovered}><mesh /></Select>
  </Selection>

KEYBOARD CONTROLS (game style):
  <KeyboardControls map={[
    { name: 'forward', keys: ['w', 'ArrowUp'] },
    { name: 'back',    keys: ['s', 'ArrowDown'] },
  ]}>
    {/* inside: const [, get] = useKeyboardControls(); get().forward */}
  </KeyboardControls>
`.trim(),

  audio: `
AUDIO IN R3F:

3D POSITIONAL AUDIO (drei):
  import { PositionalAudio } from '@react-three/drei'
  <mesh>
    <sphereGeometry />
    <meshStandardMaterial />
    <PositionalAudio url="/sound.mp3" distance={5} loop />
  </mesh>
  Sound attenuates with distance. Must be child of the mesh it's attached to.

WEB AUDIO API (direct):
  const ctx = new AudioContext()
  const buf = await fetch('/sound.mp3').then(r => r.arrayBuffer()).then(b => ctx.decodeAudioData(b))
  const src = ctx.createBufferSource(); src.buffer = buf; src.connect(ctx.destination); src.start()

BACKGROUND MUSIC (react-use-audio-player):
  import { useAudioPlayer } from 'react-use-audio-player'
  const { play, pause, stop } = useAudioPlayer({ src: '/music.mp3', autoplay: false, loop: true })
  // Trigger from a click event (browsers block autoplay without interaction)

HOWLER.JS (if not in R3F context):
  import { Howl } from 'howler'
  const sound = new Howl({ src: ['/shoot.mp3'], volume: 0.5 })
  sound.play()

SYNC AUDIO TO ANIMATION:
  useFrame(() => {
    const amplitude = analyser.getFloatTimeDomainData(dataArray)
    meshRef.current.scale.y = 1 + amplitude * 2  // audio-reactive mesh
  })

TIPS:
  - Browsers BLOCK autoplay until user interaction. Trigger audio from click/keypress.
  - rolloffFactor and refDistance tune how quickly 3D audio fades with distance.
  - useThree's addEffect is useful for syncing the audio clock to the render clock.
`.trim(),

  environment: `
ENVIRONMENT AND SKYBOX BEST PRACTICES:

QUICKEST QUALITY BOOST:
  <Environment preset="city" />   // adds lighting AND reflections simultaneously

ENVIRONMENT PRESETS (drei):
  "studio"/"city"/"sunset"/"dawn"/"night"/"forest"/"apartment"/"park"/"warehouse"/"lobby"

GROUND PROJECTION (real shadows on env floor):
  <Environment preset="sunset" ground={{ height: 15, radius: 60, scale: 100 }} />

CUSTOM HDRI:
  <Environment files="/hdr/environment.hdr" />
  Free HDRIs: polyhaven.com/hdris (1K for realtime, 4K for baking)

SKY WITH REALISTIC SUN:
  <Sky sunPosition={[100, 20, 100]} turbidity={0.1} rayleigh={0.5} />

STARS BACKGROUND:
  <Stars radius={100} depth={50} count={5000} factor={4} saturation={0} fade speed={1} />

REFLECTIVE FLOOR:
  <MeshReflectorMaterial blur={[300, 100]} resolution={1024}
    mixBlur={1} mixStrength={50} roughness={0.5} depthScale={1.2}
    color="#202030" metalness={0.5} />

BACKGROUND COLOR (always set something):
  <color attach="background" args={['#0a0a14']} />
  NEVER leave the default black without intention — it signals an unfinished scene.

FOG FOR ATMOSPHERE (fog color MUST match background):
  <fog attach="fog" args={['#1a1a2e', 5, 30]} />         // linear
  <fogExp2 attach="fog" args={['#1a1a2e', 0.05]} />      // exponential

LIGHTFORMERS (custom area lights in env):
  <Environment background={false}>
    <Lightformer position={[5, 5, -5]} scale={[10, 5, 1]} intensity={2} color="#ff8866" />
    <Lightformer position={[-5, 0, 0]} scale={[1, 10, 1]} intensity={1} color="#88aaff" />
  </Environment>

TIPS:
  - background={false} on Environment gives reflections without visible background.
  - Match fog color to background — mismatch immediately reads as unfinished.
  - For outdoor scenes: Sky + directional light with shadows.
  - For indoor scenes: Environment preset="apartment" + spot lights.
`.trim(),

  scenes: `
SCENE ENVIRONMENT PROFILES FOR R3F:

The scaffold_project tool applies these automatically. Use this for manual setup or inject_code.

────────────────────────────────────────────────────
SPACE (solar, planets, asteroids, cosmic, galaxy)
────────────────────────────────────────────────────
Background:  #000000  |  Fog: near=50 far=200
Ground:      NONE — never put a ground plane in space
Lighting:    ambientLight intensity 0.05; pointLight for the star (decay=0, no falloff)
Atmosphere:  <Stars radius={300} depth={60} count={10000} factor={7} saturation={0} />
Camera:      [0, 15, 30]  fov 50
Post:        Bloom (luminanceThreshold 0.1, high intensity) — feed with color={[5,3,0]} materials
Colors:      Black, deep purple/blue, bright white for stars, orange/yellow for stars

──────────────────────────────────────────────────────
UNDERWATER (ocean, sea, aquatic, coral, marine)
──────────────────────────────────────────────────────
Background:  #0a2a3a  |  Fog: near=1 far=30 — heavy fog sells the depth
Ground:      Sandy sea floor (#c4a882)
Lighting:    Directional from above with blue-green tint (#6af0ff), low ambient
Camera:      [0, 2, 8]  fov 60
Post:        ChromaticAberration + Bloom for caustic glow

─────────────────────────────────────────────────────────────────
PRODUCT SHOWCASE (sneakers, watches, furniture, configurators)
─────────────────────────────────────────────────────────────────
Background:  #1a1a1a  |  No fog
Ground:      ContactShadows instead of mesh floor
Lighting:    Three-point studio (key warm, fill cool, rim back)
Environment: <Environment preset="studio" />
Camera:      [0, 1, 5]  fov 40  (low fov = less distortion)
Post:        ToneMapping ACES_FILMIC + SMAA only — no Bloom (keeps edges crisp)

────────────────────────────────────────────────────────
NATURE (forest, garden, landscape, terrain, trees)
────────────────────────────────────────────────────────
Background:  #c9e2f0 (sky blue)  |  Fog: near=10 far=100
Ground:      Large grass plane (#4a7a3a) with receiveShadow
Lighting:    Warm directional sun + soft ambient
Atmosphere:  <Sky sunPosition={[100, 50, 80]} turbidity={0.1} />
Environment: <Environment preset="forest" background={false} />
Camera:      [0, 3, 15]  fov 60

────────────────────────────────────────────────────────────────
INTERIOR (room, apartment, office, gallery, museum)
────────────────────────────────────────────────────────────────
Background:  #1a1510  |  No fog
Ground:      Wooden/concrete floor (#8a7060) with receiveShadow
Lighting:    Warm spot lights (color #ffd080) + very low ambient
Environment: <Environment preset="apartment" background={false} />
Camera:      [0, 1.6, 5]  fov 60  — eye level (1.6m = human height)

──────────────────────────────────────────────────────────────────────
GAME (shooter, platformer, racing, RPG, battle, arcade)
──────────────────────────────────────────────────────────────────────
Background:  #0a0a1a  |  Fog: near=20 far=80
Ground:      Dark game floor (#0f0f22)
Lighting:    Strong directional (shadows) + colored point lights for drama
Camera:      [0, 8, 12]  fov 65 (elevated for overview)
Post:        Bloom (intensity 0.5) + Vignette

─────────────────────────────────────────────────────────────────────────────
ABSTRACT / GENERATIVE / ART (installation, immersive, dream)
─────────────────────────────────────────────────────────────────────────────
Background:  #0a0a0a  |  Fog: near=5 far=50
Ground:      NONE — things float in void
Lighting:    Colored point lights only (magenta, cyan, green) — no ambient
Controls:    autoRotate for gallery feel
Post:        HEAVY — Bloom + ChromaticAberration + Vignette

THE FOUR UNIVERSAL RULES:
1. Background is NEVER #ffffff. Minimum dark neutral: #1a1a2e.
2. Fog color ALWAYS matches background exactly.
3. Space scenes NEVER get a ground plane.
4. ambientLight alone makes scenes flat — always pair with directional/spot.
`.trim(),

  architecture: `
ARCHITECTURE & MENTAL MODEL FOR R3F:

LAYERED ARCHITECTURE (outside in):
  DOM layer      — Framer Motion / Tailwind for chrome (nav, filters, overlays, control bars).
  Scene layer    — <Canvas>, camera rig, global lighting, <ScrollControls> or <View.Port />.
  Object layer   — per-mesh useFrame loops that mutate refs (position, scale, opacity, uniforms).
  Shader layer   — raw GLSL or TSL. React owns structure, GLSL owns pixels.

SINGLE-CANVAS RULE: Browsers cap WebGL contexts (~8).
  NEVER: spin up multiple <Canvas> instances.
  INSTEAD: Drei <View> + <View.Port /> OR r3f-scroll-rig GlobalCanvas + UseCanvas tunnel.

ANIMATION THROUGH REFS, NOT STATE:
  FREE:    meshRef.current.position.x = newVal  (no reconciliation)
  COSTLY:  setState(newVal) → React reconciles → kills frame rate
  STATE:   Use only for structural changes (mount/unmount, scene swaps, material changes).

STATE MANAGEMENT (pmndrs stack):
  zustand  — module-level, immutable, selector-based. DEFAULT CHOICE for game state, UI state.
  jotai    — atom-based, component scope. Good for derived/computed state.
  valtio   — proxy-based, mutate directly. Best for data-heavy configurators.
  Select slices: useStore(state => state.x) not useStore() to avoid unnecessary re-renders.

KEY R3F HOOKS:
  useThree()          — { gl, scene, camera, size, viewport, invalidate, get, set }
  useFrame(cb, prio)  — render loop; priority controls order (lower = earlier)
  useLoader(Loader, url) — cached loading, Suspense-compatible
  useGraph(object)    — traverse GLTF node graph by name
  extend({ MyClass }) — register Three.js class as JSX element

CANVAS CONFIG FOR POSTPROCESSING:
  <Canvas gl={{ antialias: false, stencil: false, depth: false }}>
  Let the EffectComposer handle AA via <SMAA /> — disabling defaults avoids redundant passes.
`.trim(),

  scroll: `
SCROLL-DRIVEN SCENES IN R3F:

APPROACH 1 — Drei ScrollControls (single-canvas, simplest):
  <ScrollControls pages={3} damping={0.3}>
    <Scene />
    <Scroll html><div>HTML scrolls in lockstep</div></Scroll>
  </ScrollControls>
  const scroll = useScroll()  // inside ScrollControls
  scroll.offset            // 0–1 normalized scroll position
  scroll.range(0, 0.3)     // 0–1 within a range of the scroll
  scroll.curve(0, 0.3)     // 0–1 with ease in+out
  scroll.visible(0, 0.3)   // boolean: is this range visible?

APPROACH 2 — GSAP Timeline + useScroll().seek() (most control):
  const tl = useRef()
  const scroll = useScroll()
  useLayoutEffect(() => {
    tl.current = gsap.timeline()
    tl.current.to(ref.current.position, { y: -5, duration: 2 }, 0)
    tl.current.to(ref.current.rotation, { y: Math.PI, duration: 1 }, 1)
    tl.current.to(material, { opacity: 0, duration: 0.5 }, 1.5)
  }, [])
  useFrame(() => tl.current.seek(scroll.offset * tl.current.duration()))

APPROACH 3 — r3f-scroll-rig (DOM-tracked, HTML-first sites):
  <GlobalCanvas />   — single persistent canvas across route changes
  <SmoothScrollbar /> — Lenis under the hood
  <ScrollScene track={domRef}> — tunnel WebGL to match DOM element position/scale
  useTracker() / useScrollbar() / useScrollRig() — low-level hooks

LENIS SMOOTH SCROLL (standalone):
  import { addEffect } from '@react-three/fiber'
  import Lenis from 'lenis'
  const lenis = new Lenis()
  addEffect((t) => lenis.raf(t))  // sync R3F and Lenis clocks

DREI VIEW / VIEW.PORT (multi-region, one canvas):
  DOM: <div ref={trackRef}><View track={trackRef}><Mesh3D /></View></div>
  Canvas: <Canvas><View.Port /></Canvas>
  Each View gets its own camera and scene but shares the WebGL context.
  Note: useFrame does NOT work inside View children — use useThree with scene outside.

GSAP SCROLLTRIGGER (DOM scroll with 3D):
  gsap.registerPlugin(ScrollTrigger)
  gsap.to(ref.current.rotation, {
    y: Math.PI * 2, ease: 'none',
    scrollTrigger: { trigger: '#section', start: 'top center', end: 'bottom center', scrub: true }
  })
`.trim(),

  models: `
MODELS, ASSETS & LOADING IN R3F:

GLTFJSX WORKFLOW (the canonical approach):
  npx gltfjsx model.glb -t -s
  Generates typed JSX with named nodes and materials.
  Edit it like regular JSX: swap materials, animate parts, conditionally render meshes.
  useAnimations(animations, ref) from drei handles AnimationMixer automatically.

COMPRESSION PIPELINE (10x size + 10x VRAM gains):
  Geometry:  gltf-transform draco model.glb out.glb      (Draco compression)
             OR Meshopt (faster decompression)
  Textures:  gltf-transform optimize in.glb out.glb \\
             --texture-compress ktx2 --compress draco
  KTX2 modes:
    UASTC  — normals, hero textures (quality-first)
    ETC1S  — diffuse, secondary textures (size-first)
  Configure decoders once globally:
    dracoLoader.setDecoderPath('/draco/')
    ktx2Loader.setTranscoderPath('/basis/')

LOADING PATTERNS:
  useGLTF('/model.glb')                        — cached, Suspense-compatible
  useGLTF.preload('/model.glb')                — preload before mount (outside component)
  useTexture('/tex.jpg')                       — cached texture
  useLoader(THREE.AudioLoader, '/sound.mp3')   — any Three.js loader
  <Suspense fallback={<Loader />}>             — Drei's <Loader /> is polished default
  Lazy-load below fold: React.lazy + dynamic import for <Canvas>

ENVIRONMENT / HDRI:
  useEnvironment({ preset: 'city' })           — preload before render
  Free HDRIs: polyhaven.com/hdris (1K for realtime, use 4K only for baking)

GAUSSIAN SPLATTING:
  <Splat src='/scene.splat' />                 — Drei built-in
  Photogrammetry scenes as .splat or .ply. Pair with <Float> for ambient motion.

PERFORMANCE:
  useGLTF caches by URL — import once, reference everywhere.
  Clone with <Clone object={nodes.Mesh} /> for cheap duplication without re-loading.
  <Sampler> distributes instances across mesh surfaces (grass, fur, moss).
`.trim(),

  libraries: `
COMPANION LIBRARY STACK FOR R3F:

PMNDRS CORE:
  @react-three/drei         — helpers, materials, controls, staging (the essential one)
  @react-three/postprocessing — effects composer (v3 for R3F v9 / React 19)
  @react-three/rapier       — physics (v2 for R3F v9 / React 19)
  @react-three/uikit        — Yoga flexbox WebGL UI components, fully animatable
  @react-three/offscreen    — render canvas in a Web Worker (perf isolation)
  @react-three/flex         — flexbox layout in 3D space
  @react-three/xr           — WebXR (VR/AR) support
  @react-three/lightmap     — runtime lightmap baking

ANIMATION:
  @react-spring/three       — physics-based springs, declarative API, BEST for hover/click
  framer-motion-3d          — Framer Motion API for 3D (<motion.mesh>)
  gsap + gsap/ScrollTrigger — timeline-based, industry standard for scroll sequences
  theatre.js (@theatre/core + @theatre/r3f) — keyframe editor with visual Studio panel

MATH / UTILITIES:
  maath                     — easing (damp, damp3, dampE), random distributions, vector helpers
  miniplex                  — entity-component-system for game-ish architectures
  use-gesture               — pointer/touch/drag gestures (@use-gesture/react)
  leva                      — instant GUI controls (sliders, pickers, folders) for dev

SCROLLING & LAYOUT:
  lenis                     — smooth scroll (addEffect to sync with R3F)
  @14islands/r3f-scroll-rig — DOM-tracked WebGL, GlobalCanvas, ScrollScene, useTracker

SHADERS & FX:
  lygia / resolve-lygia     — massive GLSL function library (#include "lygia/generative/…")
  glslify + glsl-noise      — modular GLSL imports
  meshline                  — billboarded line (variable width, smooth curves)
  @funtech-inc/use-shader-fx — fluid sims, distortion, ripple effects as React hooks

MODELING & RAYCASTING:
  three-mesh-bvh (via drei <Bvh>) — 100x faster raycasting on complex meshes
  camera-controls             — used inside drei <CameraControls>, can be used directly

PARTICLES & VFX:
  wawa-vfx                  — <VFXParticles> + <VFXEmitter>, GPU-accelerated
  three.quarks + quarks.r3f  — Unity-shuriken emitters, SizeOverLife, ColorOverLife

MONITORING:
  r3f-perf                  — overlay: draw calls, vertices, GPU timing, shader count
  stats-gl / stats.js       — frame timing overlay

CURRENT VERSION BASELINE (mid-2026):
  react / react-dom         ^19.0.0
  three                     ^0.184.0
  @react-three/fiber        ^9.0.0
  @react-three/drei         ^10.0.0
  @react-three/postprocessing ^3.0.0 (+ postprocessing ^6.36.0)
  @react-three/rapier       ^2.0.0  (+ @dimforge/rapier3d-compat ^0.19.0)
`.trim(),

  effects: `
CREATIVE EFFECT INVENTORY (30+ concrete recipes):

REVEALS & TRANSITIONS:
  Image reveal on scroll     — shaderMaterial plane, Perlin noise + radial gradient mask,
                               drive uProgress 0→1; vertex sine wave fades with progress.
  Page transition wipe       — fullscreen quad, threshold noise + displacement, GSAP.
  Morph reveal               — mesh morph targets, useAnimations or morphTargetInfluences[i].

SCROLL EXPERIENCES:
  Infinite 3D image tube     — cylindrical layout, shader curvature deformation, inertial velocity uniform.
  Scroll-driven cinematic    — GSAP timeline + seek(scroll.offset), choreographing camera + lights + morphs.
  Submarine / character ride — water shader (vertex wave + fragment ripple) + mouse uMouse uniform.
  Office walkthrough         — single GLB, scroll-driven y-translation + rotation (Wawa Sensei pattern).

PRODUCT & SHOWCASE:
  Curved 3D product grid     — planes on cylinder slice, holographic sheen via fresnel, spring-damped hover.
  WebGL carousel             — planes along x, uniform thickness/distortion tied to scroll velocity.
  3D lens distortion         — sphere with MeshTransmissionMaterial tracking pointer (refracts page behind).
  Holographic card           — iridescent gradient plane, fresnel sheen offset by view direction.

ATMOSPHERE & ENVIRONMENT:
  Procedural galaxy          — points buffer, polar coordinates with arm offsets, additive blending + bloom.
  Volumetric clouds          — 3D Perlin/FBM + ray march, density accumulated into alpha.
  Topographic background     — simplex contour bands, great for grids and product backdrops.
  Magic sparkles             — drei <Sparkles> + selective bloom.

SHADERS & MATERIALS:
  Iridescent crystal         — SDF (octahedron) raymarching, refraction per-channel IOR, env lookup.
  Caustics                   — render light through refractive mesh into FBO, splat onto plane as texture.
  Liquid raymarching         — fullscreen quad, SDF smoothMin of spheres, diffuse + specular + fresnel.
  Goo / metaballs            — drei <MarchingCubes> + MeshTransmissionMaterial.
  Holographic sheen          — custom shader: fresnel + scrolling iridescent HSL gradient + view direction.
  ASCII / dithering          — drei <AsciiRenderer> or custom ordered-dither postprocess effect.

INTERACTIVITY:
  Hover-reactive surface     — pass uMouse to noise displacement, spring-damped return.
  Drag-to-reveal             — raycasting intersection, animate uProgress based on drag distance.
  Click impulse              — Rapier applyImpulse on physics body, visual spring feedback.
  Mouse trail                — Trail component or custom FBO particle system following pointer.

PARTICLES:
  Swirling particle flow     — curl noise FBO (divergence-free → no clumping).
  Firefly / dust             — slow sin-based movement, random seed offsets, additive blending.
  Constellation              — star positions from image luminance, lines connecting proximity pairs.

AUDIO-REACTIVE:
  Waveform mesh              — AnalyserNode data → morphTargetInfluences or vertex displacement.
  Beat-sync scale            — audio amplitude → spring target scale on beat detection.

REFERENCE SITES (for "make it look like X"):
  Bruno Simon's Three.js Journey — gold-standard foundational R3F patterns.
  Maxime Heckel's blog           — deep-dive shaders: caustics, refraction, FBO, raymarching.
  Codrops (tympanus.net)         — image reveals, tubes, carousels, transmission tricks; always current.
  Wawa Sensei                    — scroll, physics, postprocessing, VFX, WebGPU/TSL, GPGPU.
  Pmndrs sandbox (drcmda)        — Paul Henschel's lens, transmission, instancing, physics demos.
  Shadertoy                      — fragment shader inspiration; port via <ScreenQuad>.
  Inigo Quilez (iquilezles.org)  — SDF math, raymarching, color palettes — bedrock for procedural work.
`.trim(),

  heuristics: `
MCP TOOL GENERATION HEURISTICS (defaults for every component Claude generates):

ALWAYS:
  ✓ Wrap asset-loading in <Suspense>. <Suspense fallback={<Loader />}> is safe everywhere.
  ✓ Set a <color attach="background"> or Environment background. Never leave the canvas void.
  ✓ Use ACES_FILMIC ToneMapping as the LAST effect in every EffectComposer.
  ✓ Multiply by delta in useFrame: rotation.y += delta * speed (never +=0.01).
  ✓ Use damp/damp3 from maath for smooth frame-rate-independent following.
  ✓ Use <Environment preset="city" background={false} /> as the default for any PBR scene.
  ✓ Declare OrbitControls with makeDefault so controls and cameras sync.
  ✓ Use meshStandardMaterial with explicit metalness + roughness (never meshBasicMaterial for lit objects).
  ✓ Include receieveShadow + castShadow on relevant meshes when shadows are in the scene.
  ✓ Wrap objects in <group> for clean transform management.

FOR BLOOM:
  ✓ Default luminanceThreshold={1}, not threshold=0 (global glow looks cheap).
  ✓ Lift material colors above 1.0: color={[5, 2, 0]} on meshBasicMaterial to feed selective bloom.
  ✓ ALWAYS enable mipmapBlur — without it bloom looks harsh.

FOR COUNTS > ~20 OF THE SAME GEOMETRY:
  ✓ Default to <instancedMesh> (or drei <Instances>). Never individual <mesh> in a .map().
  ✓ Low-poly for particle instances: sphereGeometry [r, 6, 6] not [r, 32, 32].

FOR FRAMELOOP:
  ✓ Default to frameloop="demand" + invalidate() when no continuous animation is described.
  ✓ frameloop="always" only when continuous animation is explicitly needed.

FOR "WOW" REQUESTS — layer these five:
  HDRI environment + Bloom + SoftShadows/AccumulativeShadows + MeshTransmissionMaterial + Sparkles/Trail
  The combination creates "awe" — any one alone is good, all five together is cinematic.

PREFER DREI PRE-BUILT over hand-rolled:
  MeshTransmissionMaterial > transparent meshPhysicalMaterial for glass
  MeshReflectorMaterial > custom mirror shader
  ContactShadows > manual shadow plane
  <Float> > manual sin bobbing
  <Trail> > custom trail system
  useAnimations > manual AnimationMixer

SCROLL CHOREOGRAPHY:
  Prefer GSAP timeline + seek(scroll.offset) over manual math for anything with >2 animated values.
  Prefer Drei ScrollControls + useScroll() for single-canvas scroll scenes.

NEVER:
  ✗ setState inside useFrame (reconciliation kills frame rate).
  ✗ new THREE.Vector3() inside useFrame (allocates every frame).
  ✗ White (#ffffff) or near-white background — minimum dark neutral #1a1a2e.
  ✗ meshBasicMaterial for objects that should react to lighting.
  ✗ ambientLight alone — always pair with at least one directional/spot.
  ✗ Multiple <Canvas> instances — use <View> + <View.Port /> instead.
  ✗ High segment counts for small particles: not sphereGeometry [r, 32, 32].
  ✗ Bloom luminanceThreshold < 0.5 for general use (everything glows → nothing glows).
`.trim(),

  webgpu: `
WEBGPU & TSL (Three Shader Language) — THE FUTURE:

TSL compiles to WGSL (WebGPU) AND GLSL (WebGL). Write once, run on both.
R3F v10 alpha + Drei v11 alpha track WebGPU. Import from three/tsl and three/webgpu.

SETUP:
  import { WebGPURenderer } from 'three/webgpu'
  // In R3F: <Canvas gl={(canvas) => new WebGPURenderer({ canvas })} />
  // Fallback: forceWebGL: true to test the GLSL path

TSL IMPORTS (three/tsl):
  Math/flow: Fn, float, vec2, vec3, vec4, int, bool, If, Loop, Return
  Values:    uniform, attribute, varying, const
  Built-ins: time, uv, positionLocal, positionWorld, normalLocal, normalWorld,
             viewDirection, cameraPosition, modelViewMatrix, projectionMatrix
  Noise:     mx_noise_float, mx_fractal_noise_float, mx_noise_vec3
  Math:      sin, cos, abs, max, min, mix, step, smoothstep, clamp, pow, sqrt, length, dot, cross, normalize, saturate

TSL MATERIAL NODE EXAMPLE:
  import { color, sin, time, mx_fractal_noise_float, Fn, vec3, positionLocal } from 'three/tsl'
  import { MeshStandardNodeMaterial } from 'three/webgpu'

  const fresnel = Fn(([n, v, p]) => float(1).sub(n.dot(v).saturate()).pow(p))

  const mat = new MeshStandardNodeMaterial()
  mat.colorNode = color(1, 0, 0).mul(sin(time).mul(0.5).add(0.5))
  mat.positionNode = positionLocal.add(vec3(0, mx_fractal_noise_float(positionLocal.mul(2)), 0))
  mat.emissiveNode = fresnel(normalWorld, viewDirection, float(3)).mul(color(0.2, 0.5, 1))

COMPUTE SHADERS (GPU particles, physics, fluid):
  import { instancedArray, compute, instanceIndex, storage } from 'three/tsl'
  const positions = instancedArray(count, 'vec3')
  const velocities = instancedArray(count, 'vec3')
  const updatePhysics = compute(() => {
    const pos = positions.element(instanceIndex)
    const vel = velocities.element(instanceIndex)
    pos.assign(pos.add(vel.mul(time.fwidth())))
  }, count)
  renderer.compute(updatePhysics)  // dispatch each frame

STORAGE TEXTURES (fluid sims, image processing):
  import { storageTexture, textureStore } from 'three/tsl'
  const tex = storageTexture(width, height)
  textureStore(tex, uv, value)   // write
  texture(tex, uv)               // read

INSTANCED ARRAY (persistent GPU buffer, replaces CPU instancedMesh):
  const offsets = instancedArray(count, 'vec3')
  // Fill from JS: offsets.array[i] = new THREE.Vector3(…)
  // Or fill from compute shader — stays on GPU entirely

RENDERER API CHANGES:
  await renderer.init()                    // required before first render
  renderer.renderAsync(scene, camera)      // async for compute-heavy scenes
  renderer.compute(computeNode)            // dispatch compute shader

STATUS (mid-2026):
  WebGPU ships in Chrome 113+, Firefox Nightly, Safari 18+.
  R3F v10 + Drei v11 are in alpha — use for new greenfield WebGPU projects.
  Stick with R3F v9 + WebGL for production until v10 is stable.
`.trim(),

};

// ─── Handler ──────────────────────────────────────────────────────────────────

type ReferenceContent = { content: Array<{ type: 'text'; text: string }> };

export async function handleR3FReference(
  args: R3FReferenceInput,
): Promise<ReferenceContent> {
  const sections = args.topics.map(topic => {
    const content = KNOWLEDGE[topic];
    return `${'═'.repeat(60)}\n${topic.toUpperCase()}\n${'═'.repeat(60)}\n${content}`;
  });

  const text =
    `R3F CREATIVE CODING REFERENCE\n` +
    `Topics: ${args.topics.join(', ')}\n\n` +
    sections.join('\n\n');

  return { content: [{ type: 'text', text }] };
}
