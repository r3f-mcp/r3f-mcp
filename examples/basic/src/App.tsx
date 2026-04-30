import { Canvas } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import { MCPProvider, MCPStatusIndicator, useMCPStatus } from 'r3f-mcp';

// ─── HTML overlay ─────────────────────────────────────────────────────────────
//
// Lives outside <Canvas>, so it uses the module-level store via useMCPStatus().
// No prop-drilling or manual status state needed — MCPProvider writes to the
// store automatically and the hook subscribes via useSyncExternalStore.

function Overlay() {
  const { status, connectedAt, lastError } = useMCPStatus();

  return (
    <div
      style={{
        position:       'fixed',
        top:            12,
        right:          12,
        display:        'flex',
        flexDirection:  'column',
        alignItems:     'flex-end',
        gap:            6,
        pointerEvents:  'none',
        userSelect:     'none',
        zIndex:         1000,
      }}
    >
      {/* Status pill using MCPStatusIndicator for the dot */}
      <div
        style={{
          display:        'flex',
          alignItems:     'center',
          gap:            8,
          padding:        '5px 12px',
          borderRadius:   20,
          background:     'rgba(0,0,0,0.65)',
          backdropFilter: 'blur(6px)',
          border:         '1px solid rgba(255,255,255,0.08)',
          color:          '#fff',
          fontFamily:     '"SF Mono","Fira Code","Cascadia Code",monospace',
          fontSize:       11,
          letterSpacing:  '0.04em',
          whiteSpace:     'nowrap',
        }}
      >
        {/* The indicator reads from the same useMCPStatus() hook */}
        <MCPStatusIndicator size={7} />
        <span style={{ color: 'rgba(255,255,255,0.45)' }}>r3f-mcp</span>
        <span
          style={{
            color: status === 'connected'
              ? '#22c55e'
              : status === 'error'
              ? '#ef4444'
              : status === 'disconnected'
              ? '#6b7280'
              : '#f59e0b',
          }}
        >
          {status}
          {status === 'connected' && connectedAt &&
            ` · ${connectedAt.toLocaleTimeString()}`}
        </span>
      </div>

      {/* Error detail banner */}
      {lastError && status === 'error' && (
        <div
          style={{
            maxWidth:    280,
            padding:     '4px 10px',
            borderRadius: 6,
            background:   'rgba(239,68,68,0.15)',
            border:       '1px solid rgba(239,68,68,0.3)',
            color:        '#fca5a5',
            fontFamily:   '"SF Mono","Fira Code","Cascadia Code",monospace',
            fontSize:     10,
            lineHeight:   1.5,
            wordBreak:    'break-word',
          }}
        >
          {lastError}
        </div>
      )}
    </div>
  );
}

// ─── Scene ────────────────────────────────────────────────────────────────────

function Scene() {
  return (
    <MCPProvider port={3333}>
      {/* Lighting */}
      <ambientLight intensity={0.5} />
      <directionalLight
        position={[5, 5, 5]}
        intensity={1}
        castShadow
        shadow-mapSize={[1024, 1024]}
      />

      {/* RedBox */}
      <mesh name="RedBox" position={[0, 1, 0]} castShadow receiveShadow>
        <boxGeometry args={[1, 1, 1]} />
        <meshStandardMaterial color="#ef4444" />
      </mesh>

      {/* BlueSphere */}
      <mesh name="BlueSphere" position={[-2, 0.5, 0]} castShadow receiveShadow>
        <sphereGeometry args={[0.5, 32, 32]} />
        <meshStandardMaterial color="#3b82f6" />
      </mesh>

      {/* GreenTorus */}
      <mesh name="GreenTorus" position={[2, 0.5, 0]} castShadow receiveShadow>
        <torusGeometry args={[0.4, 0.15, 16, 48]} />
        <meshStandardMaterial color="#22c55e" />
      </mesh>

      {/* Ground */}
      <mesh
        name="Ground"
        position={[0, 0, 0]}
        rotation={[-Math.PI / 2, 0, 0]}
        scale={[10, 10, 1]}
        receiveShadow
      >
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
        // preserveDrawingBuffer lets gl.domElement.toDataURL() capture the
        // current frame reliably — required for the screenshot MCP tool.
        gl={{ preserveDrawingBuffer: true }}
      >
        <Scene />
      </Canvas>

      {/*
       * Overlay renders outside Canvas in the regular DOM tree.
       * useMCPStatus() inside Overlay reads from the module-level store that
       * MCPProvider populates — no onStatus prop or useState needed here.
       */}
      <Overlay />
    </>
  );
}
