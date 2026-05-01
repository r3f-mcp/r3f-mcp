import { z } from 'zod';
import type { Tool } from '@modelcontextprotocol/sdk/types.js';

// ─── Schema ───────────────────────────────────────────────────────────────────

const VALID_TOPICS = [
  'materials', 'lighting', 'animation', 'post-processing', 'camera',
  'physics', 'particles', 'text', 'shaders', 'performance',
  'composition', 'interactivity', 'audio', 'environment',
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
    'Get best practices, recipes, and pro tips for creating high-quality React Three Fiber scenes. ' +
    'Call this BEFORE generating any component to ensure professional-quality output. ' +
    'Topics: materials, lighting, animation, post-processing, camera, physics, particles, ' +
    'text, shaders, performance, composition, interactivity, audio, environment. ' +
    'This is embedded expert knowledge — no internet fetch required.',
  inputSchema: {
    type: 'object',
    properties: {
      topics: {
        type: 'array',
        items: {
          type: 'string',
          enum: [...VALID_TOPICS],
        },
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

Golden rule: Never use meshBasicMaterial for anything that should look real. Use meshStandardMaterial
as your default; meshPhysicalMaterial for glass, water, or car paint.

Pro material setups:

1. Realistic metal
   <meshStandardMaterial color="#888888" metalness={1} roughness={0.2} envMapIntensity={1} />
   Always pair with an environment map — without one, metals look flat.

2. Matte/clay
   <meshStandardMaterial color="#e8dcc8" metalness={0} roughness={1} />

3. Glass/crystal (best quality)
   // Import MeshTransmissionMaterial from @react-three/drei
   <MeshTransmissionMaterial backside samples={16} resolution={512}
     transmission={1} roughness={0} thickness={0.5} ior={1.5}
     chromaticAberration={0.06} anisotropy={0.1} />
   Dramatically better than transparent meshPhysicalMaterial.

4. Glossy plastic with clearcoat
   <meshPhysicalMaterial color="#ff4444" metalness={0} roughness={0.3}
     clearcoat={1} clearcoatRoughness={0.1} />

5. Emissive/glowing
   <meshStandardMaterial color="#ff6600" emissive="#ff6600" emissiveIntensity={2} />
   Pair with Bloom post-processing — without bloom, emissive only brightens, doesn't glow.

6. Iridescent/holographic
   // MeshDistortMaterial from @react-three/drei
   <MeshDistortMaterial color="#8855ff" metalness={0.8} roughness={0.2}
     distort={0.3} speed={2} />

Tips:
- Metals need an env map; add <Environment preset="studio" /> for instant reflections.
- Prefer alphaTest over transparent for cutout effects — avoids sort issues.
- For many identical objects use instancedMesh with one shared material.
- Side={THREE.DoubleSide} is expensive; only use when both sides are visible.
`.trim(),

  lighting: `
LIGHTING BEST PRACTICES FOR R3F:

Golden rule: Add <Environment preset="studio" /> from @react-three/drei immediately.
It's the single highest-impact quality improvement — reflections, soft light, depth.

Environment presets (import from @react-three/drei):
  "studio"     soft neutral — great for products
  "city"       urban HDR — realistic outdoor reflections
  "sunset"     warm golden hour
  "dawn"       soft pink/blue
  "night"      dark with accent lights
  "forest"     green-tinted natural
  "apartment"  warm interior
  "park"       bright daylight
  "warehouse"  industrial
  "lobby"      soft architectural

Three-point lighting setup (film/photography standard):
  <ambientLight intensity={0.2} />                              // keep low
  <directionalLight position={[5, 5, 5]} intensity={1.5} castShadow />   // key
  <directionalLight position={[-5, 3, -5]} intensity={0.5} />             // fill
  <directionalLight position={[0, 5, -10]} intensity={0.8} />             // rim

Shadow setup for quality:
  <directionalLight castShadow
    shadow-mapSize-width={2048} shadow-mapSize-height={2048}
    shadow-camera-far={50}
    shadow-camera-left={-10} shadow-camera-right={10}
    shadow-camera-top={10} shadow-camera-bottom={-10}
    shadow-bias={-0.0001} />
  Don't forget: <Canvas shadows> and receiveShadow/castShadow on meshes.

Quick attractive shadows: <ContactShadows position={[0,-0.01,0]} opacity={0.5} scale={10} blur={2} /> (drei)
Soft baked shadows: <AccumulativeShadows> (drei)

Tips:
- Never rely on ambientLight alone — it kills depth.
- Color temperature: warm 0xfff0dd, cool 0xd0e0ff.
- <Lightformer> inside <Environment> adds custom light shapes to the env map.
- Spot lights with penumbra look more natural than point lights.
`.trim(),

  animation: `
ANIMATION BEST PRACTICES FOR R3F:

Golden rule: Never use linear interpolation for user-visible animation. Use easing.
The difference between amateur and professional is easing.

useFrame patterns:

1. Frame-rate independent rotation
   useFrame((state, delta) => {
     meshRef.current.rotation.y += delta * 0.5;
   });

2. Floating/bobbing (the "Apple product shot" effect)
   useFrame((state) => {
     const t = state.clock.elapsedTime;
     meshRef.current.position.y = Math.sin(t) * 0.2 + baseY;
     meshRef.current.rotation.x = Math.sin(t * 0.3) * 0.1;
     meshRef.current.rotation.z = Math.cos(t * 0.2) * 0.05;
   });
   Key: use different frequencies per axis — same frequency looks mechanical.

3. Smooth follow with lerp/slerp
   useFrame(() => {
     meshRef.current.position.lerp(target, 0.05);
     meshRef.current.quaternion.slerp(targetQ, 0.05);
   });

4. Spring animations (best for interactive)
   // @react-spring/three
   const [springs, api] = useSpring(() => ({
     scale: [1,1,1],
     config: { mass: 1, tension: 170, friction: 26 },
   }));
   <animated.mesh scale={springs.scale}
     onPointerOver={() => api.start({ scale: [1.2,1.2,1.2] })}
     onPointerOut={()  => api.start({ scale: [1,1,1] })}
   />

5. <Float> from drei — easy bobbing in one line
   <Float speed={1.5} rotationIntensity={0.5} floatIntensity={0.5}>
     <mesh />
   </Float>

Tips:
- ALWAYS multiply by delta in useFrame for frame-rate independence.
- Stagger animations for groups — avoid animating everything simultaneously.
- THREE.MathUtils.damp(current, target, lambda, delta) for smoothed transitions.
- Math.sin/cos with primes (0.3, 0.7, 1.3) creates organic, non-repeating motion.
`.trim(),

  'post-processing': `
POST-PROCESSING BEST PRACTICES FOR R3F:

Use @react-three/postprocessing (wraps pmndrs/postprocessing — much faster than three/examples).
Import: EffectComposer, Bloom, Vignette, ChromaticAberration, ToneMapping, SMAA, DepthOfField

Essential base setup:
  <EffectComposer>
    <Bloom luminanceThreshold={0.9} luminanceSmoothing={0.025} intensity={0.5} mipmapBlur />
    <Vignette offset={0.5} darkness={0.5} />
    <ToneMapping mode={ToneMappingMode.ACES_FILMIC} />
  </EffectComposer>

Recipes:

1. Cinematic look
   <Bloom intensity={0.3} luminanceThreshold={0.8} mipmapBlur />
   <Vignette offset={0.5} darkness={0.5} />
   <ChromaticAberration offset={[0.001, 0.001]} />
   <ToneMapping mode={ToneMappingMode.ACES_FILMIC} />

2. Neon/cyberpunk
   <Bloom intensity={1.5} luminanceThreshold={0.1} mipmapBlur />
   Use emissiveIntensity 2–5 on materials to feed the bloom.

3. Dreamy/soft
   <Bloom intensity={0.5} luminanceThreshold={0.5} luminanceSmoothing={0.9} mipmapBlur />
   <DepthOfField focusDistance={0.01} focalLength={0.02} bokehScale={3} />

4. Clean product shot
   <ToneMapping mode={ToneMappingMode.ACES_FILMIC} />
   <SMAA />

Tips:
- Always use mipmapBlur with Bloom — without it bloom looks harsh.
- Always use ACES_FILMIC tone mapping for realistic color.
- Less is more — subtle effects look pro, heavy effects look amateurish.
- SMAA is cheaper and better-looking than default MSAA.
- N8AO from drei is better ambient occlusion than SSAO from postprocessing.
`.trim(),

  camera: `
CAMERA BEST PRACTICES FOR R3F:

Default camera positions for common scenarios:
  Product/object showcase:   [0, 2, 5] with fov 50
  Interior/architectural:    [0, 1.6, 0] looking around (first-person)
  Hero/dramatic:             [0, 0.5, 3] looking slightly up, fov 35
  Top-down strategy:         [0, 10, 0] fov 60
  Isometric-ish:             [10, 10, 10] fov 30 (low fov = more isometric)

Controls:
  <OrbitControls makeDefault />                    free orbit
  <PresentationControls>                           constrained for products
  <FlyControls>                                    first-person fly
  <PointerLockControls>                            FPS game

Animated cameras using useFrame:
  useFrame((state) => {
    const t = state.clock.elapsedTime;
    state.camera.position.x = Math.sin(t * 0.2) * 5;
    state.camera.position.z = Math.cos(t * 0.2) * 5;
    state.camera.lookAt(0, 0, 0);
  });

Smooth camera transition with lerp:
  useFrame(({ camera }) => {
    camera.position.lerp(targetPos, 0.05);
    camera.lookAt(focusPoint);
  });

Tips:
- Lower fov (30–50) looks cinematic; higher fov (60–90) for games/VR.
- <CameraShake> from drei adds film-like micro-jitter.
- <ScrollControls> from drei enables scroll-driven camera paths.
- Use camera.near = 0.1, camera.far = 1000 as defaults; adjust for scene scale.
`.trim(),

  physics: `
PHYSICS WITH @react-three/rapier:

Setup:
  import { Physics, RigidBody, CuboidCollider, BallCollider } from '@react-three/rapier'
  // Wrap scene content in <Physics>
  <Physics gravity={[0, -9.81, 0]}>
    <RigidBody>
      <mesh><boxGeometry /><meshStandardMaterial /></mesh>
    </RigidBody>
    <RigidBody type="fixed">
      <mesh rotation={[-Math.PI/2, 0, 0]}><planeGeometry args={[20,20]} /></mesh>
    </RigidBody>
  </Physics>

Body types:
  type="dynamic"           full physics (default)
  type="fixed"             immovable (floors, walls)
  type="kinematicPosition" position-controlled (animated platforms)

Common patterns:

1. Bouncy balls
   <RigidBody restitution={0.8} friction={0.5}>

2. Apply impulse on click
   const rbRef = useRef()
   <RigidBody ref={rbRef}>
   onClick={() => rbRef.current.applyImpulse({ x: 0, y: 5, z: 0 }, true)

3. Read body state
   useFrame(() => {
     const pos = rbRef.current.translation()
     const vel = rbRef.current.linvel()
   })

4. Trigger zones (sensors)
   <RigidBody type="fixed" sensor onIntersectionEnter={() => console.log('entered!')}>
     <BallCollider args={[2]} />
   </RigidBody>

Tips:
- useRegisterPhysics(world) from r3f-mcp exposes the world to the AI tools.
- debug prop on <Physics> shows collider outlines.
- Use CuboidCollider/BallCollider explicitly for better performance than auto-detection.
- Rapier uses meters — keep objects at real-world scale (1 unit = 1 m).
`.trim(),

  particles: `
PARTICLES BEST PRACTICES FOR R3F:

Golden rule: Use instancedMesh or Points for anything over 100 particles.
Individual meshes per particle kills performance.

1. Star field / floating dust (Points — fastest)
   const positions = useMemo(() => {
     const arr = new Float32Array(5000 * 3);
     for (let i = 0; i < arr.length; i++) arr[i] = (Math.random() - 0.5) * 50;
     return arr;
   }, []);
   <points>
     <bufferGeometry>
       <bufferAttribute attach="attributes-position" count={5000} array={positions} itemSize={3} />
     </bufferGeometry>
     <pointsMaterial size={0.05} color="#ffffff" sizeAttenuation transparent opacity={0.8} />
   </points>

2. Animated instanced particles (instancedMesh)
   const dummy = useMemo(() => new THREE.Object3D(), []);
   const particles = useMemo(() => Array.from({ length: 200 }, () => ({
     pos: [(Math.random()-0.5)*10, Math.random()*5, (Math.random()-0.5)*10],
     speed: Math.random() * 0.5 + 0.2,
   })), []);
   useFrame(({ clock }) => {
     particles.forEach((p, i) => {
       dummy.position.set(p.pos[0], p.pos[1] + Math.sin(clock.elapsedTime * p.speed) * 0.3, p.pos[2]);
       dummy.updateMatrix();
       ref.current.setMatrixAt(i, dummy.matrix);
     });
     ref.current.instanceMatrix.needsUpdate = true;
   });
   <instancedMesh ref={ref} args={[undefined, undefined, 200]}>
     <sphereGeometry args={[0.05, 6, 6]} />
     <meshStandardMaterial color="#88aaff" emissive="#88aaff" emissiveIntensity={0.5} />
   </instancedMesh>

3. Quick magic dust: <Sparkles count={50} scale={5} size={2} speed={0.5} /> (drei)
4. Trails: <Trail> component from drei

Tips:
- Use low-poly for instanced particles: sphereGeometry args [r, 6, 6] not [r, 32, 32].
- Glowing particles: blending={THREE.AdditiveBlending} depthWrite={false}.
- Add variety: randomize size, speed, starting phase for organic feel.
- For trails use drei's <Trail> component.
`.trim(),

  text: `
3D TEXT IN R3F:

1. Simple 3D text (drei)
   import { Text3D, Center } from '@react-three/drei'
   <Center>
     <Text3D font="/fonts/helvetiker_regular.typeface.json" size={1} height={0.2}
       curveSegments={12} bevelEnabled bevelThickness={0.02} bevelSize={0.02}>
       Hello World
       <meshStandardMaterial color="#ffffff" metalness={0.5} roughness={0.3} />
     </Text3D>
   </Center>
   Fonts: download .typeface.json from drei's font collection or convert with facetype.js.

2. Billboard text (always faces camera)
   import { Text } from '@react-three/drei'
   <Text fontSize={0.5} color="#ffffff" anchorX="center" anchorY="middle">
     Label
   </Text>

3. HTML overlay on 3D point
   import { Html } from '@react-three/drei'
   <Html position={[0, 2, 0]} center>
     <div style={{ color: 'white', background: 'rgba(0,0,0,0.5)', padding: '4px 8px' }}>
       Tooltip
     </div>
   </Html>

Tips:
- Text3D needs a font file — always use Center to reposition after loading.
- For many labels, prefer <Text> (2D sprite) over Text3D for performance.
- Use <Html> for rich interactive overlays (buttons, input fields).
- Distort text by animating scale with sin/cos on individual letters (map over chars).
`.trim(),

  shaders: `
CUSTOM SHADER TIPS FOR R3F:

Use drei's shaderMaterial helper:
  import { shaderMaterial } from '@react-three/drei'
  import { extend } from '@react-three/fiber'

  const WaveMaterial = shaderMaterial(
    { uTime: 0, uColor: new THREE.Color('#ff0000') },
    // vertex shader
    \`varying vec2 vUv;
    void main() {
      vUv = uv;
      vec3 pos = position;
      pos.z += sin(pos.x * 5.0 + uTime) * 0.1;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
    }\`,
    // fragment shader
    \`uniform float uTime;
    uniform vec3 uColor;
    varying vec2 vUv;
    void main() {
      float s = sin(vUv.x * 10.0 + uTime) * 0.5 + 0.5;
      gl_FragColor = vec4(uColor * s, 1.0);
    }\`
  );
  extend({ WaveMaterial });

  // Usage in JSX:
  const matRef = useRef();
  useFrame(({ clock }) => { matRef.current.uTime = clock.elapsedTime; });
  <mesh><planeGeometry args={[2,2,32,32]} /><waveMaterial ref={matRef} /></mesh>

Common shader patterns:
  Gradient:     mix(color1, color2, vUv.y)
  Pulse:        sin(uTime) * 0.5 + 0.5
  Fresnel/rim:  pow(1.0 - dot(viewDir, normal), 3.0)
  Dissolve:     step(noise(vPosition), uProgress)
  Checkerboard: mod(floor(vUv.x * 10.0) + floor(vUv.y * 10.0), 2.0)

Tips:
- Always pass time as a uniform; never compute it in the shader from gl_FragCoord.
- Custom shaders skip PBR — use onBeforeCompile to extend existing materials if you need lighting.
- <MeshPortalMaterial> and <MeshReflectorMaterial> from drei are pre-built advanced shaders.
- For noise: use a glsl-noise import or paste simplex noise inline.
`.trim(),

  performance: `
PERFORMANCE BEST PRACTICES FOR R3F:

Profile first: use get_performance and get_performance_profile tools to identify bottlenecks.

Key metrics to watch:
  Draw calls < 100 per frame (each mesh = 1 draw call)
  Triangle count < 500K for smooth 60 fps
  Texture memory < 256 MB

Reduce draw calls:
  - Merge static geometry: BufferGeometryUtils.mergeGeometries([...])
  - Use instancedMesh for repeated objects (1 draw call for 10K instances)
  - Use <Merged> from drei to auto-merge compatible geometry

Reduce triangle count:
  - LOD: use fewer segments for distant objects (sphereGeometry args [r, 8, 8] not [r, 64, 64])
  - drei's <Detailed> component for automatic LOD
  - Bake normal maps instead of high-poly geometry

Texture optimization:
  - Use power-of-two texture sizes (512, 1024, 2048)
  - Compress with KTX2 / Basis format
  - <useTexture> from drei caches texture loads

R3F-specific optimizations:
  - <Canvas frameloop="demand"> renders only when state changes (great for static scenes)
  - <Canvas performance={{ min: 0.5 }}> auto-scales pixel ratio under load
  - Dispose geometry/materials on unmount: useEffect(() => () => geo.dispose(), [])
  - Frustum culling is automatic — ensure object.frustumCulled = true (default)

useFrame tips:
  - Don't create objects inside useFrame (new Vector3(), new Color()) — allocate once with useMemo/useRef
  - Use ref.current checks before accessing — component may unmount
  - Expensive computations: only run every N frames using state.clock.elapsedTime % interval

React tips:
  - Avoid re-renders: useMemo for geometry/material, useRef instead of useState for animation values
  - Use <Suspense> to lazy-load heavy assets
  - drei's <Preload all> preloads all pending assets
`.trim(),

  composition: `
SCENE COMPOSITION BEST PRACTICES:

Follow photography and film composition rules.

1. Rule of thirds: don't center everything. Place key objects at 1/3 or 2/3 positions.

2. Depth layering — always have foreground, midground, background:
   Near:    close objects, possibly blurred with DepthOfField
   Middle:  main subject
   Far:     environment, skybox, fog

3. Ground plane — almost every scene needs one:
   <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
     <planeGeometry args={[50, 50]} />
     <meshStandardMaterial color="#1a1a1a" />
   </mesh>
   Or <ContactShadows> for a minimal, clean ground shadow.

4. Fog adds depth and atmosphere:
   <fog attach="fog" args={['#000000', 5, 30]} />

5. Scale: keep 1 unit = 1 meter for predictable lighting and physics behavior.

6. Color palette: max 2–3 main colors + neutrals. Use a dark background (#0a0a0a, not #000000).

7. Negative space: don't fill every corner. Empty space draws focus to the subject.

Quick atmosphere additions:
  <Stars radius={100} depth={50} count={5000} factor={4} fade speed={1} />  (drei)
  <Sky sunPosition={[100, 20, 100]} turbidity={0.1} />                      (drei)
  <fog attach="fog" args={['#1a1a2e', 5, 30]} />
  <color attach="background" args={['#0a0a14']} />

Camera heights:
  y: 5–10    authority / overview
  y: 1.6     eye level / intimacy
  y: 0.5     dramatic low angle

Tips:
  - Group related objects and animate the group, not individuals.
  - <PresentationControls> from drei for constrained product viewing.
  - Match fog color to background color — mismatches look amateur.
`.trim(),

  interactivity: `
INTERACTIVITY BEST PRACTICES FOR R3F:

1. Hover with spring (the professional standard)
   const [hovered, setHovered] = useState(false);
   const { scale } = useSpring({ scale: hovered ? 1.15 : 1, config: { tension: 200, friction: 20 } });
   <animated.mesh scale={scale}
     onPointerOver={() => { setHovered(true); document.body.style.cursor = 'pointer'; }}
     onPointerOut={()  => { setHovered(false); document.body.style.cursor = 'default'; }}
   />

2. Click with propagation guard
   <mesh onClick={(e) => {
     e.stopPropagation(); // prevent click-through to objects behind
     handleClick();
   }} />

3. Drag (@use-gesture/react)
   import { useDrag } from '@use-gesture/react'
   const [pos, setPos] = useState([0, 0, 0]);
   const bind = useDrag(({ offset: [x, y] }) => setPos([x / 100, -y / 100, 0]));
   <mesh {...bind()} position={pos} />

4. Raycasting optimization
   - Set raycast={null} on non-interactive objects.
   - <BVH> from drei accelerates raycasting on complex meshes.
   - Use layers to exclude objects from raycasting.

5. HTML labels/tooltips on 3D objects
   <Html position={[0, 1.5, 0]} center distanceFactor={10}>
     <div style={{ background: 'rgba(0,0,0,0.8)', color: 'white', padding: '4px 8px', borderRadius: 4 }}>
       Label
     </div>
   </Html>

Tips:
  - Always e.stopPropagation() in click handlers.
  - Combine hover with spring for responsive feel — setState + spring is the pattern.
  - Reset cursor on pointerOut — forgetting this leaves a stuck pointer cursor.
  - <Canvas eventPrefix="client"> for correct coordinates with CSS transforms.
`.trim(),

  audio: `
AUDIO IN R3F:

Use @react-three/drei's <PositionalAudio> for 3D spatialized sound:

  import { PositionalAudio } from '@react-three/drei'
  <mesh>
    <sphereGeometry />
    <meshStandardMaterial />
    <PositionalAudio url="/sound.mp3" distance={5} loop />
  </mesh>

For non-positional audio (background music, UI sounds), use the Web Audio API directly or
a library like Howler.js alongside your R3F scene.

React-use-audio-player is a simple option:
  import { useAudioPlayer } from 'react-use-audio-player'
  const { play, pause } = useAudioPlayer({ src: '/music.mp3', autoplay: true, loop: true })

Tips:
  - Browsers block autoplay until user interaction — trigger audio from a click/keypress.
  - <PositionalAudio> needs to be a child of the mesh it's attached to.
  - Use rolloffFactor and refDistance to tune how quickly audio fades with distance.
  - For click/hover sounds, create and play an AudioBuffer in the event handler.
`.trim(),

  environment: `
ENVIRONMENT AND SKYBOX BEST PRACTICES:

1. Quickest quality boost (do this first)
   <Environment preset="city" />   // adds lighting AND reflections

2. Environment with ground
   <Environment preset="sunset" ground={{ height: 15, radius: 60, scale: 100 }} />

3. Custom HDRI
   <Environment files="/hdr/environment.hdr" />
   Free HDRIs: polyhaven.com/hdris

4. Sky with realistic sun
   import { Sky } from '@react-three/drei'
   <Sky sunPosition={[100, 20, 100]} turbidity={0.1} rayleigh={0.5} />

5. Stars
   import { Stars } from '@react-three/drei'
   <Stars radius={100} depth={50} count={5000} factor={4} saturation={0} fade speed={1} />

6. Solid background color
   <color attach="background" args={['#0a0a14']} />

7. Gradient background (use a large sphere + gradient shader, or:)
   // CSS on the canvas parent element with a gradient background

8. Fog for depth/atmosphere
   <fog attach="fog" args={['#1a1a2e', 5, 30]} />         // linear fog
   <fogExp2 attach="fog" args={['#1a1a2e', 0.05]} />      // exponential fog

9. Reflective floor
   import { MeshReflectorMaterial } from '@react-three/drei'
   <mesh rotation={[-Math.PI/2, 0, 0]}>
     <planeGeometry args={[20, 20]} />
     <MeshReflectorMaterial blur={[300, 100]} resolution={1024} mixBlur={1}
       mixStrength={50} roughness={0.5} depthScale={1.2} color="#202030" metalness={0.5} />
   </mesh>

Tips:
  - background={false} on <Environment> gives reflections without visible background.
  - Match fog color to background — mismatch breaks immersion.
  - For outdoor scenes: Sky + directionalLight with shadows.
  - For indoor scenes: Environment preset="apartment" + spot lights.
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
