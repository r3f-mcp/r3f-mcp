import React from 'react';

interface Props {
  children: React.ReactNode;
  /** Called when the wrapped component throws during render. */
  onError?: (error: Error) => void;
  /**
   * Rendered in place of the failed component.
   * Defaults to a small red wireframe cube so the AI can see that something
   * failed without crashing the whole scene.
   */
  fallback?: React.ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

/**
 * React error boundary that catches render-time errors in injected preview
 * components. On error it renders a fallback (red wireframe box) instead of
 * crashing, and calls `onError` so MCPProvider can report the error back to
 * Claude for self-correction.
 */
export class InjectionErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error): void {
    this.props.onError?.(error);
  }

  render(): React.ReactNode {
    if (this.state.hasError) {
      if (this.props.fallback !== undefined) return this.props.fallback;
      // Default fallback: a small red wireframe box so the AI can see the slot
      return React.createElement(
        'mesh',
        null,
        React.createElement('boxGeometry', { args: [0.5, 0.5, 0.5] }),
        React.createElement('meshBasicMaterial', { color: '#ef4444', wireframe: true }),
      );
    }
    return this.props.children;
  }
}
