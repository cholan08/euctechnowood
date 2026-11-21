import express, { type NextFunction, type Request, type Response } from 'express';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { config } from './config';
import { redesignRouter } from './routes/redesign';

export function createApp() {
  const app = express();
  if (config.trustProxy) app.set('trust proxy', 1); // behind Nginx / Render / Railway
  app.disable('x-powered-by');

  // Room photos arrive as base64 JSON; the browser shrinks them to 1536px first.
  app.use(express.json({ limit: '15mb' }));
  app.use((_req, res, next) => {
    res.setHeader('x-content-type-options', 'nosniff');
    next();
  });

  app.use('/api', redesignRouter);
  app.use('/api', (_req, res) => void res.status(404).json({ error: 'Not found.' }));

  // In production, serve the built frontend (npm run build) from the same server.
  if (existsSync(config.distDir)) {
    app.use(express.static(config.distDir));
    // Client-side routes must still load the app.
    app.get(/^(?!\/api\/).*/, (_req, res) => {
      res.sendFile(path.join(config.distDir, 'index.html'));
    });
  }

  app.use((err: { status?: number; message?: string }, _req: Request, res: Response, _next: NextFunction) => {
    const status = err.status ?? 500;
    if (status >= 500) console.error(err);
    const generic = status === 413 ? 'That image is too large.' : status < 500 ? 'Bad request.' : 'Server error.';
    // In development show the real reason so problems are quick to find.
    res.status(status).json({ error: !config.isProd && status >= 500 && err.message ? `Server error: ${err.message}` : generic });
  });

  return app;
}
