import react from '@vitejs/plugin-react';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';

export default defineConfig({
  // Run from the repo root (npm scripts), but treat client/ as the app folder.
  root: fileURLToPath(new URL('.', import.meta.url)),
  plugins: [react()],
  build: { outDir: 'dist', emptyOutDir: true }, // -> client/dist, served by the server in production
  server: {
    // During development the Vite UI (port 5173) forwards API calls to the Express server.
    proxy: { '/api': 'http://localhost:8787' },
  },
});
