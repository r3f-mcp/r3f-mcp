export { MCPProvider, default } from './MCPProvider';
export { useMCPStatus, MCPStatusIndicator, MCPContext } from './useMCPStatus';
export type { MCPState, MCPStatusIndicatorProps } from './useMCPStatus';
export { useRegisterAnimation } from './animationRegistry';
export { useRegisterPhysics } from './physicsRegistry';
export { evaluateComponent, buildInjectionScope } from './injectionEvaluator';
export type { InjectionEntry } from './types';
export { serializeScene, serializeObject, findObject, applyTransform, applyMaterial } from './SceneSerializer';
export { SceneBridge } from './WebSocketServer';
export type { SceneBridgeOptions, ConnectionStatus } from './WebSocketServer';
export type {
  SerializedGeometry,
  SerializedMaterial,
  SerializedLight,
  SerializedCamera,
  SerializedNode,
  MaterialSide,
  // WebSocket protocol
  ServerToClientMessage,
  ClientToServerMessage,
  AnyMessage,
  GetSceneGraphMessage,
  GetObjectMessage,
  SetTransformMessage,
  SetMaterialMessage,
  SetVisibleMessage,
  TakeScreenshotMessage,
  SceneGraphResponseMessage,
  ObjectResponseMessage,
  ScreenshotResponseMessage,
  EditConfirmationMessage,
  ErrorMessage,
  // Component props
  MCPProviderProps,
  EditEvent,
  // v0.3 result types
  AnimationInfo,
  AnimationControlResult,
  PhysicsCollider,
  PhysicsBody,
  PhysicsJoint,
  PhysicsResult,
  SceneStats,
  PerformanceResult,
  HeavyObject,
  ProfileResult,
} from './types';
