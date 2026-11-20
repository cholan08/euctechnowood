import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [react()],
  server: {
    // During development the Vite UI (port 5173) forwards API calls and image links to the Express server.
    proxy: { '/api': 'http://localhost:8787', '/uploads': 'http://localhost:8787' },
  },
});
