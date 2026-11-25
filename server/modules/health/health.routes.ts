import { Router } from 'express';

/** GET /api/health: used by Render's health check and shown in the app bar. */
export function healthRoutes({ provider }: { provider: string }): Router {
  const router = Router();
  router.get('/health', (_req, res) => {
    res.json({ ok: true, provider });
  });
  return router;
}
