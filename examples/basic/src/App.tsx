import { useEffect, useRef, useState } from 'react';
import { useFrame, Canvas } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import {
  MCPProvider,
  MCPStatusIndicator,
  useMCPStatus,
  useRegisterAnimation,
} from 'r3f-mcp';
import {
  AnimationMixer,
  AnimationClip,
  NumberKeyframeTrack,
  LoopRepeat,
} from 'three';
import type { Mesh } from 'three';

// ─── Status + injection overlay ───────────────────────────────────────────────

function Overlay() {
  const { status, connectedAt, lastError } = useMCPStatus();
  const [showHint, setShowHint] = useState(true);

  // Hide the keyboard hint after 6 s
  useEffect(() => {
    const t = setTimeout(() => setShowHint(false), 6000);
    return () => clearTimeout(t);
  }, []);

  return (
    <div
      style={{
        position: 'fixed', top: 12, right: 12,
        display: 'flex', flexDirection: 'column', alignItems: 'flex-end',
        gap: 6, pointerEvents: 'none', userSelect: 'none', zIndex: 1000,
      }}
    >
      {/* Status pill */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 8,
        padding: '5px 12px', borderRadius: 20,
        background: 'rgba(0,0,0,0.65)', backdropFilter: 'blur(6px)',
        border: '1px solid rgba(255,255,255,0.08)',
        color: '#fff', fontFamily: '"SF Mono","Fira Code",monospace',
        fontSize: 11, letterSpacing: '0.04em', whiteSpace: 'nowrap',
      }}>
        <MCPStatusIndicator size={7} />
        <span style={{ color: 'rgba(255,255,255,0.45)' }}>r3f-mcp</span>
        <span style={{
          color: status === 'connected' ? '#22c55e'
               : status === 'error'     ? '#ef4444'
               : status === 'disconnected' ? '#6b7280' : '#f59e0b',
        }}>
          {status}
          {status === 'connected' && connectedAt && ` · ${connectedAt.toLocaleTimeString()}`}
        </span>
      </div>

      {/* Error banner */}
      {lastError && status === 'error' && (
        <div style={{
          maxWidth: 280, padding: '4px 10px', borderRadius: 6,
          background: 'rgba(239,68,68,0.15)', border: '1px solid rgba(239,68,68,0.3)',
          color: '#fca5a5', fontFamily: '"SF Mono","Fira Code",monospace',
          fontSize: 10, lineHeight: 1.5, wordBreak: 'break-word',
        }}>
          {lastError}
        </div>
      )}

      {/* Hint fades out after 6 s */}
      {showHint && status === 'connected' && (
        <div style={{
          padding: '3px 10px', borderRadius: 6,
          background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)',
          color: 'rgba(255,255,255,0.4)', fontFamily: '"SF Mono",monospace',
          fontSize: 10, whiteSpace: 'nowrap',
        }}>
          Ask Claude: "What's in the scene?" or "Add a glowing sphere"
        </div>
      )}
    </div>
  );
}

// ─── Animated RedBox ──────────────────────────────────────────────────────────

function AnimatedRedBox() {
  const meshRef  = useRef<Mesh>(null);
  const mixerRef = useRef<AnimationMixer | null>(null);

  useEffect(() => {
    const mesh = meshRef.current;
    if (!mesh) return;

    const mixer = new AnimationMixer(mesh);
    const clip  = new AnimationClip('spin', 3, [
      new NumberKeyframeTrack('.rotation[y]', [0, 1.5, 3], [0, Math.PI, Math.PI * 2]),
    ]);
    const action = mixer.clipAction(clip);
    action.setLoop(LoopRepeat, Infinity);
    action.play();

    // Store in userData so get_animations can detect without explicit registration
    mesh.userData.mixer = mixer;
    mixerRef.current = mixer;

    return () => {
      mixer.stopAllAction();
      delete mesh.userData.mixer;
      mixerRef.current = null;
    };
  }, []);

  useRegisterAnimation(meshRef.current, mixerRef.current);

  useFrame((_, delta) => {
    mixerRef.current?.update(delta);
  });

  return (
    <mesh ref={meshRef} name="RedBox" position={[0, 1, 0]} castShadow receiveShadow>
      <boxGeometry args={[1, 1, 1]} />
      <meshStandardMaterial color="#ef4444" />
    </mesh>
  );
}

// ─── Scene ────────────────────────────────────────────────────────────────────

function Scene() {
  return (
    <MCPProvider port={3333}>
      <ambientLight intensity={0.5} />
      <directionalLight position={[5, 5, 5]} intensity={1} castShadow shadow-mapSize={[1024, 1024]} />

      {/* v0.3 demo: the RedBox runs a spinner animation via AnimationMixer */}
      <AnimatedRedBox />

      <mesh name="BlueSphere" position={[-2, 0.5, 0]} castShadow receiveShadow>
        <sphereGeometry args={[0.5, 32, 32]} />
        <meshStandardMaterial color="#3b82f6" />
      </mesh>

      <mesh name="GreenTorus" position={[2, 0.5, 0]} castShadow receiveShadow>
        <torusGeometry args={[0.4, 0.15, 16, 48]} />
        <meshStandardMaterial color="#22c55e" />
      </mesh>

      <mesh name="Ground" position={[0, 0, 0]} rotation={[-Math.PI / 2, 0, 0]} scale={[10, 10, 1]} receiveShadow>
        <planeGeometry args={[1, 1]} />
        <meshStandardMaterial color="white" roughness={0.8} metalness={0} />
      </mesh>

      <OrbitControls makeDefault />
    </MCPProvider>
  );
}

// ─── App ──────────────────────────────────────────────────────────────────────

export function App() {
  return (
    <>
      <Canvas
        shadows
        camera={{ position: [4, 3, 6], fov: 50 }}
        gl={{ preserveDrawingBuffer: true }}
      >
        <Scene />
      </Canvas>
      <Overlay />
    </>
  );
}
