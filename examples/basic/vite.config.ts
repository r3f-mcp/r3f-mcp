import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath, URL } from 'node:url';

// Alias r3f-mcp to the local client source so Vite transforms it directly.
// This gives instant HMR when editing the client package without a build step.
const clientSrc = fileURLToPath(
  new URL('../../packages/client/src/index.ts', import.meta.url),
);

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      'r3f-mcp': clientSrc,
    },
  },
});
