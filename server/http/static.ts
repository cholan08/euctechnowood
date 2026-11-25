import express, { type Express } from 'express';
import { existsSync } from 'node:fs';
import path from 'node:path';

/** Serves the built frontend (npm run build), when there is one, from the same server as the API. */
export function serveClient(app: Express, distDir: string): void {
  if (!existsSync(distDir)) return;
  app.use(express.static(distDir));
  // Client-side routes must still load the app.
  app.get(/^(?!\/api\/).*/, (_req, res) => {
    res.sendFile(path.join(distDir, 'index.html'));
  });
}
