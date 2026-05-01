// ─── Scene environment profiles ───────────────────────────────────────────────
//
// Shared by scaffoldProject and generateComponent so both produce consistent,
// context-appropriate scene setups.

export type SceneType =
  | 'space' | 'underwater' | 'product' | 'nature'
  | 'interior' | 'game' | 'abstract' | 'portfolio' | 'default';

export interface SceneEnvironment {
  type: SceneType;
  /** Human-readable label for comments */
  label: string;
  /** Hex background color — never #ffffff */
  background: string;
  fog: false | { color: string; near: number; far: number };
  /** @react-three/drei named imports needed in App.tsx */
  dreiImports: string[];
  /** Camera position [x, y, z] */
  cameraPosition: [number, number, number];
  cameraFov: number;
  /** JSX lines for lights (indented 6 spaces) */
  lightingJsx: string;
  /** Stars, Sky, floating particles, etc. (indented 6 spaces) */
  atmosphereJsx: string;
  /** Environment map JSX, or empty string */
  environmentJsx: string;
  /** Ground/floor JSX, or empty string if no ground */
  groundJsx: string;
  /** OrbitControls JSX with scene-appropriate settings */
  controlsJsx: string;
  /** One-line reminder about recommended post-processing */
  postProcessingNote: string;
  /** Comment pasted at the top of App.tsx explaining why this setup was chosen */
  notes: string;
  // For generate_component hints
  suggestedMaterials: string;
  avoidList: string;
  colorPalette: string;
}

// ─── Profiles ────────────────────────────────────────────────────────────────

const PROFILES: Record<SceneType, SceneEnvironment> = {

  space: {
    type: 'space', label: 'Space / cosmic scene',
    background: '#000000',
    fog: { color: '#000000', near: 50, far: 200 },
    dreiImports: ['OrbitControls', 'Stars'],
    cameraPosition: [0, 15, 30], cameraFov: 50,
    lightingJsx: [
      `      {/* Space lighting: sun as a point light, very low ambient */}`,
      `      <ambientLight intensity={0.05} color="#1a0a3a" />`,
      `      <pointLight position={[0, 0, 0]} intensity={3} color="#fff9e0" decay={0} />`,
    ].join('\n'),
    atmosphereJsx: `      <Stars radius={300} depth={60} count={10000} factor={7} saturation={0} />`,
    environmentJsx: '',
    groundJsx: '', // no ground in space
    controlsJsx: `      <OrbitControls makeDefault />`,
    postProcessingNote: 'Add <EffectComposer><Bloom luminanceThreshold={0.1} intensity={1.5} mipmapBlur /></EffectComposer> for glowing planets/stars',
    notes: 'No ground plane. Black background. Stars fill the void. Use emissive materials + Bloom for glowing bodies.',
    suggestedMaterials: 'Dark base materials with high emissiveIntensity for stars/engines. Metallic surfaces for ships.',
    avoidList: 'No ground plane. No bright ambient light. No warm colors unless near a star.',
    colorPalette: 'Deep blacks, cool blues, bright whites for stars, warm orange/yellow for stars/fire.',
  },

  underwater: {
    type: 'underwater', label: 'Underwater / ocean scene',
    background: '#0a2a3a',
    fog: { color: '#0a2a3a', near: 1, far: 30 },
    dreiImports: ['OrbitControls'],
    cameraPosition: [0, 2, 8], cameraFov: 60,
    lightingJsx: [
      `      {/* Underwater lighting: sunlight filtered through water */}`,
      `      <ambientLight intensity={0.2} color="#0a5a7a" />`,
      `      <directionalLight`,
      `        position={[2, 20, 5]}`,
      `        intensity={0.8}`,
      `        color="#6af0ff"`,
      `        castShadow`,
      `        shadow-mapSize-width={1024}`,
      `        shadow-mapSize-height={1024}`,
      `      />`,
    ].join('\n'),
    atmosphereJsx: `      {/* Floating particle dust: add a <points> system for suspended particles */}`,
    environmentJsx: '',
    groundJsx: [
      `      <mesh name="SeaFloor" rotation={[-Math.PI / 2, 0, 0]} receiveShadow>`,
      `        <planeGeometry args={[60, 60]} />`,
      `        <meshStandardMaterial color="#c4a882" roughness={1} metalness={0} />`,
      `      </mesh>`,
    ].join('\n'),
    controlsJsx: `      <OrbitControls makeDefault maxPolarAngle={Math.PI * 0.85} />`,
    postProcessingNote: 'Add ChromaticAberration + Bloom for caustic glow. Consider DepthOfField for depth.',
    notes: 'Heavy blue-green fog for depth. Sandy sea floor. Sunlight from above. Slow, floaty animations.',
    suggestedMaterials: 'Blue/teal base colors. Slightly transparent for glass/jelly creatures. Sand-colored ground.',
    avoidList: 'No warm or reddish lighting. No floor visible beyond fog range. No sharp shadows.',
    colorPalette: 'Deep teals (#0a2a3a), sandy beige (#c4a882), bright cyan accents (#6af0ff).',
  },

  product: {
    type: 'product', label: 'Product showcase / studio',
    background: '#1a1a1a',
    fog: false,
    dreiImports: ['OrbitControls', 'Environment', 'ContactShadows'],
    cameraPosition: [0, 1, 5], cameraFov: 40,
    lightingJsx: [
      `      {/* Three-point studio lighting */}`,
      `      <ambientLight intensity={0.2} />`,
      `      <directionalLight position={[5, 5, 5]} intensity={1.5} castShadow color="#fff5e0" />`,
      `      <directionalLight position={[-5, 3, -5]} intensity={0.5} color="#d0e0ff" />`,
      `      <directionalLight position={[0, 5, -10]} intensity={0.8} />`,
    ].join('\n'),
    atmosphereJsx: `      <ContactShadows position={[0, -0.01, 0]} opacity={0.6} scale={20} blur={2} far={10} />`,
    environmentJsx: `      <Environment preset="studio" />`,
    groundJsx: '', // ContactShadows replaces the ground
    controlsJsx: [
      `      <OrbitControls`,
      `        makeDefault`,
      `        minDistance={2}`,
      `        maxDistance={10}`,
      `        maxPolarAngle={Math.PI / 2}`,
      `        enableDamping`,
      `      />`,
    ].join('\n'),
    postProcessingNote: 'Add ToneMapping ACES_FILMIC + SMAA for a clean product look. Skip Bloom for crisp edges.',
    notes: 'Studio environment for realistic reflections. Contact shadows instead of a visible floor. Constrained orbit.',
    suggestedMaterials: 'High-quality PBR: clear metalness + low roughness for metal parts. Physical material for glass.',
    avoidList: 'No fog. No dark background (unless product is light). No flat/basic materials.',
    colorPalette: 'Neutral dark (#1a1a1a) background. Product colors per brief. Silver/chrome accents.',
  },

  nature: {
    type: 'nature', label: 'Nature / outdoor / landscape',
    background: '#c9e2f0',
    fog: { color: '#c9e2f0', near: 10, far: 100 },
    dreiImports: ['OrbitControls', 'Sky', 'Environment'],
    cameraPosition: [0, 3, 15], cameraFov: 60,
    lightingJsx: [
      `      {/* Sun lighting — warm directional with soft ambient */}`,
      `      <ambientLight intensity={0.3} color="#fffde0" />`,
      `      <directionalLight`,
      `        position={[100, 50, 80]}`,
      `        intensity={2}`,
      `        color="#fff0c8"`,
      `        castShadow`,
      `        shadow-mapSize-width={2048}`,
      `        shadow-mapSize-height={2048}`,
      `        shadow-camera-far={200}`,
      `        shadow-camera-left={-50}`,
      `        shadow-camera-right={50}`,
      `        shadow-camera-top={50}`,
      `        shadow-camera-bottom={-50}`,
      `      />`,
    ].join('\n'),
    atmosphereJsx: `      <Sky sunPosition={[100, 50, 80]} turbidity={0.1} rayleigh={0.5} />`,
    environmentJsx: `      <Environment preset="forest" background={false} />`,
    groundJsx: [
      `      <mesh name="Ground" rotation={[-Math.PI / 2, 0, 0]} receiveShadow>`,
      `        <planeGeometry args={[200, 200]} />`,
      `        <meshStandardMaterial color="#4a7a3a" roughness={1} metalness={0} />`,
      `      </mesh>`,
    ].join('\n'),
    controlsJsx: `      <OrbitControls makeDefault maxPolarAngle={Math.PI / 2} />`,
    postProcessingNote: 'Keep post-processing subtle — ToneMapping ACES_FILMIC only. Nature looks best unprocessed.',
    notes: 'Realistic sky dome. Ground with shadows. Sun-direction fog for atmospheric depth. Warm natural palette.',
    suggestedMaterials: 'Earthy colors, high roughness. Green vegetation. Brown/grey rock. Low metalness throughout.',
    avoidList: 'No neon colors. No metallic surfaces (unless artificial objects). No dark/moody background.',
    colorPalette: 'Sky blue (#c9e2f0), grass green (#4a7a3a), warm sun (#fff0c8), earth brown (#8a6040).',
  },

  interior: {
    type: 'interior', label: 'Interior / architectural / room',
    background: '#1a1510',
    fog: false,
    dreiImports: ['OrbitControls', 'Environment'],
    cameraPosition: [0, 1.6, 5], cameraFov: 60,
    lightingJsx: [
      `      {/* Interior warm lighting: spots + low ambient */}`,
      `      <ambientLight intensity={0.1} />`,
      `      <spotLight`,
      `        position={[5, 8, 0]}`,
      `        intensity={2}`,
      `        color="#ffd080"`,
      `        castShadow`,
      `        angle={0.5}`,
      `        penumbra={0.5}`,
      `        shadow-mapSize-width={1024}`,
      `        shadow-mapSize-height={1024}`,
      `      />`,
      `      <spotLight position={[-5, 6, -3]} intensity={1} color="#ffe0c0" angle={0.6} penumbra={0.5} />`,
      `      <directionalLight position={[2, 4, 3]} intensity={0.3} color="#ffeecc" />`,
    ].join('\n'),
    atmosphereJsx: '',
    environmentJsx: `      <Environment preset="apartment" background={false} />`,
    groundJsx: [
      `      <mesh name="Floor" rotation={[-Math.PI / 2, 0, 0]} receiveShadow>`,
      `        <planeGeometry args={[20, 20]} />`,
      `        <meshStandardMaterial color="#8a7060" roughness={0.7} metalness={0.05} />`,
      `      </mesh>`,
    ].join('\n'),
    controlsJsx: [
      `      <OrbitControls`,
      `        makeDefault`,
      `        target={[0, 1, 0]}`,
      `        maxPolarAngle={Math.PI / 2}`,
      `        minDistance={1}`,
      `        maxDistance={15}`,
      `      />`,
    ].join('\n'),
    postProcessingNote: 'AccumulativeShadows from drei gives beautiful soft shadows. ToneMapping ACES_FILMIC recommended.',
    notes: 'Eye-level camera (y=1.6). Warm spot lighting. Wooden/concrete floor. Apartment environment for reflections.',
    suggestedMaterials: 'Wood (roughness 0.8, color #8a6040). Concrete (roughness 1, color #808080). Fabric (roughness 1).',
    avoidList: 'No stark white walls without texture. No point lights — use spots with penumbra. No sky.',
    colorPalette: 'Warm whites (#fff8f0), wood tones (#8a6040), warm light (#ffd080), shadow tones (#1a1510).',
  },

  game: {
    type: 'game', label: 'Game / action / interactive',
    background: '#0a0a1a',
    fog: { color: '#0a0a1a', near: 20, far: 80 },
    dreiImports: ['OrbitControls'],
    cameraPosition: [0, 8, 12], cameraFov: 65,
    lightingJsx: [
      `      {/* Dramatic game lighting with colored accents */}`,
      `      <ambientLight intensity={0.1} color="#1a1a3a" />`,
      `      <directionalLight`,
      `        position={[5, 10, 5]}`,
      `        intensity={2}`,
      `        castShadow`,
      `        shadow-mapSize-width={2048}`,
      `        shadow-mapSize-height={2048}`,
      `        shadow-bias={-0.0001}`,
      `      />`,
      `      <pointLight position={[-5, 3, -5]} intensity={1.5} color="#4040ff" />`,
      `      <pointLight position={[5, 1, 5]} intensity={1} color="#ff4040" />`,
    ].join('\n'),
    atmosphereJsx: '',
    environmentJsx: '',
    groundJsx: [
      `      <mesh name="Ground" rotation={[-Math.PI / 2, 0, 0]} receiveShadow>`,
      `        <planeGeometry args={[80, 80]} />`,
      `        <meshStandardMaterial color="#0f0f22" roughness={1} metalness={0.1} />`,
      `      </mesh>`,
    ].join('\n'),
    controlsJsx: `      <OrbitControls makeDefault target={[0, 2, 0]} />`,
    postProcessingNote: 'Bloom (intensity 0.5, luminanceThreshold 0.8) + Vignette for game feel. Consider SMAA anti-aliasing.',
    notes: 'Dark dramatic lighting with colored accents. Elevated camera for overview. Slightly elevated orbit target.',
    suggestedMaterials: 'Slightly emissive edges (#emissive with low intensity). Dark metallics for weapons/tech. Bright accent colors.',
    avoidList: 'No bright ambient (kills drama). No pastel colors. No large open white spaces.',
    colorPalette: 'Dark navy (#0a0a1a), electric blue (#4040ff), danger red (#ff4040), cool white (#e0e8ff).',
  },

  abstract: {
    type: 'abstract', label: 'Abstract / generative / art installation',
    background: '#0a0a0a',
    fog: { color: '#0a0a0a', near: 5, far: 50 },
    dreiImports: ['OrbitControls'],
    cameraPosition: [0, 0, 10], cameraFov: 60,
    lightingJsx: [
      `      {/* Dramatic colored lights — no ambient to preserve contrast */}`,
      `      <pointLight position={[5, 5, 5]} intensity={3} color="#ff4488" />`,
      `      <pointLight position={[-5, -5, -5]} intensity={2} color="#4488ff" />`,
      `      <pointLight position={[0, 5, -5]} intensity={2} color="#44ffaa" />`,
      `      <pointLight position={[0, -5, 5]} intensity={1.5} color="#ffaa44" />`,
    ].join('\n'),
    atmosphereJsx: '',
    environmentJsx: '',
    groundJsx: '', // no ground in abstract scenes
    controlsJsx: `      <OrbitControls makeDefault autoRotate autoRotateSpeed={0.3} enableDamping />`,
    postProcessingNote: 'Heavy post-processing is core to this style: Bloom (high intensity) + ChromaticAberration + Vignette.',
    notes: 'No ground. Near-black background. Dramatic colored point lights. Auto-rotate for gallery feel.',
    suggestedMaterials: 'High emissive materials to feed into Bloom. Metallic surfaces that catch colored lights.',
    avoidList: 'No ground plane. No ambient light. No realistic/naturalistic colors.',
    colorPalette: 'Deep black (#0a0a0a) base. Saturated neons: magenta (#ff4488), cyan (#44ffaa), electric blue (#4488ff).',
  },

  portfolio: {
    type: 'portfolio', label: 'Portfolio / website / hero section',
    background: '#0f0f0f',
    fog: { color: '#0f0f0f', near: 10, far: 50 },
    dreiImports: ['OrbitControls', 'Environment'],
    cameraPosition: [0, 0, 10], cameraFov: 50,
    lightingJsx: [
      `      {/* Clean, professional lighting from environment */}`,
      `      <ambientLight intensity={0.3} />`,
      `      <directionalLight position={[5, 5, 5]} intensity={1} castShadow />`,
      `      <directionalLight position={[-5, 3, -5]} intensity={0.3} color="#d0e0ff" />`,
    ].join('\n'),
    atmosphereJsx: '',
    environmentJsx: `      <Environment preset="city" background={false} />`,
    groundJsx: '', // no ground — things float
    controlsJsx: `      <OrbitControls makeDefault enableZoom={false} enableDamping />`,
    postProcessingNote: 'Subtle ToneMapping ACES_FILMIC + SMAA only. Resist heavy effects for professional look.',
    notes: 'Clean, professional. Objects float without a ground. Scroll animations (useScroll from drei) work well here.',
    suggestedMaterials: 'Clean metallics, subtle glass, carefully chosen brand colors. High quality over complexity.',
    avoidList: 'No garish effects. No ground plane. No heavy fog. No autoRotate by default (user controls).',
    colorPalette: 'Near black (#0f0f0f) + brand accent colors + clean whites/silvers.',
  },

  default: {
    type: 'default', label: 'General purpose scene',
    background: '#1a1a2e',
    fog: { color: '#1a1a2e', near: 10, far: 50 },
    dreiImports: ['OrbitControls', 'Environment', 'ContactShadows'],
    cameraPosition: [0, 3, 10], cameraFov: 50,
    lightingJsx: [
      `      <ambientLight intensity={0.2} />`,
      `      <directionalLight position={[5, 5, 5]} intensity={1.5} castShadow shadow-mapSize-width={2048} shadow-mapSize-height={2048} />`,
      `      <directionalLight position={[-5, 3, -5]} intensity={0.5} color="#d0e0ff" />`,
      `      <directionalLight position={[0, 5, -10]} intensity={0.8} />`,
    ].join('\n'),
    atmosphereJsx: `      <ContactShadows position={[0, -0.01, 0]} opacity={0.4} scale={20} blur={2} />`,
    environmentJsx: `      <Environment preset="city" background={false} />`,
    groundJsx: [
      `      <mesh name="Ground" rotation={[-Math.PI / 2, 0, 0]} receiveShadow>`,
      `        <planeGeometry args={[50, 50]} />`,
      `        <meshStandardMaterial color="#2a2a3e" roughness={1} />`,
      `      </mesh>`,
    ].join('\n'),
    controlsJsx: `      <OrbitControls makeDefault />`,
    postProcessingNote: 'ToneMapping ACES_FILMIC + light Bloom (luminanceThreshold 0.9) recommended.',
    notes: 'Dark neutral background. Three-point lighting. City environment for subtle reflections.',
    suggestedMaterials: 'meshStandardMaterial with explicit metalness/roughness. Dark neutrals for ground/background.',
    avoidList: 'Never #ffffff background. Never ambientLight alone (kills depth).',
    colorPalette: 'Dark navy (#1a1a2e) base. Cool grays. Accent colors per project.',
  },
};

// ─── Keyword matcher ──────────────────────────────────────────────────────────

/**
 * Analyse a project description and return the most appropriate SceneEnvironment.
 * Keyword matching is intentionally broad — false positives are fine as long as
 * the chosen profile is more suitable than the generic default.
 */
export function determineEnvironment(description: string): SceneEnvironment {
  const d = description.toLowerCase();

  if (
    d.includes('space')    || d.includes('solar')   || d.includes('planet')  ||
    d.includes('galaxy')   || d.includes('star')    || d.includes('orbit')   ||
    d.includes('asteroid') || d.includes('cosmic')  || d.includes('nebula')  ||
    d.includes('spacecraft')|| d.includes('rocket')  || d.includes('universe')
  ) return PROFILES.space;

  if (
    d.includes('underwater') || d.includes('ocean')  || d.includes('sea')     ||
    d.includes('aquatic')    || d.includes('marine') || d.includes('coral')   ||
    d.includes('submarine')  || d.includes('diving') || d.includes('fish')
  ) return PROFILES.underwater;

  if (
    d.includes('product')    || d.includes('showcase') || d.includes('display')  ||
    d.includes('store')      || d.includes('ecommerce')|| d.includes('configurator') ||
    d.includes('sneaker')    || d.includes('shoe')    || d.includes('watch')    ||
    d.includes('jewelry')    || d.includes('furniture')|| d.includes('3d viewer')||
    d.includes('spin')       || d.includes('360')
  ) return PROFILES.product;

  if (
    d.includes('forest')   || d.includes('garden')   || d.includes('outdoor')  ||
    d.includes('landscape')|| d.includes('mountain') || d.includes('terrain')  ||
    d.includes('tree')     || d.includes('nature')   || d.includes('field')    ||
    d.includes('grass')    || d.includes('river')    || d.includes('canyon')
  ) return PROFILES.nature;

  if (
    d.includes('room')     || d.includes('interior') || d.includes('apartment') ||
    d.includes('house')    || d.includes('office')   || d.includes('gallery')   ||
    d.includes('museum')   || d.includes('lobby')    || d.includes('kitchen')   ||
    d.includes('bedroom')  || d.includes('studio')   || d.includes('warehouse')
  ) return PROFILES.interior;

  if (
    d.includes('game')     || d.includes('shooter')  || d.includes('platformer') ||
    d.includes('racing')   || d.includes('arcade')   || d.includes('battle')     ||
    d.includes('rpg')      || d.includes('adventure')|| d.includes('dungeon')    ||
    d.includes('fps')      || d.includes('player')   || d.includes('enemy')      ||
    d.includes('level')    || d.includes('score')
  ) return PROFILES.game;

  if (
    d.includes('abstract')  || d.includes('generative') || d.includes('installation') ||
    d.includes('immersive') || d.includes('dream')    || d.includes('psychedelic') ||
    d.includes('glitch')    || d.includes('vaporwave')|| d.includes('geometric art') ||
    d.includes('particle art')
  ) return PROFILES.abstract;

  if (
    d.includes('portfolio') || d.includes('website')  || d.includes('landing page') ||
    d.includes('hero section')|| d.includes('homepage')|| d.includes('cv')          ||
    d.includes('resume')    || d.includes('personal site')
  ) return PROFILES.portfolio;

  return PROFILES.default;
}
