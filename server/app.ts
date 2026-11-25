import express from 'express';
import type { Config } from './config';
import type { Db } from './db/database';
import { authenticate } from './http/auth';
import { apiNotFound, errorHandler, securityHeaders } from './http/middleware';
import { createQuota } from './http/quota';
import { serveClient } from './http/static';
import { assistRoutes } from './modules/assist/assist.routes';
import { createAssistService } from './modules/assist/assist.service';
import { authRoutes } from './modules/auth/auth.routes';
import { createAuthService, type AuthService } from './modules/auth/auth.service';
import { healthRoutes } from './modules/health/health.routes';
import { studioRoutes } from './modules/studio/studio.routes';
import { createStudioService } from './modules/studio/studio.service';
import { teamRoutes } from './modules/team/team.routes';
import { createUsageService } from './modules/usage/usage.service';
import { workspaceRoutes } from './modules/workspace/workspace.routes';
import type { Providers } from './providers/types';
import type { ImageStore } from './storage/imageStore';

const HOUR = 60 * 60 * 1000;

export interface AppDeps {
  config: Config;
  providers: Providers;
  db: Db;
  images: ImageStore;
}

/**
 * Wires the app: middleware, then each module's routes under /api, then the
 * built frontend and the error handler. Everything comes in through `deps`, so
 * tests build the app with the mock provider, an in-memory database and an
 * in-memory image store.
 */
export function createApp({ config, providers, db, images }: AppDeps): express.Express & { auth: AuthService } {
  const showErrorDetail = !config.isProd;
  const studio = createStudioService({ image: providers.image, showErrorDetail });
  const assist = createAssistService({ text: providers.text, showErrorDetail });
  const auth = createAuthService(db, { idleHours: config.sessionIdleHours });
  const usage = createUsageService(db, { defaultLimit: config.dailyImageLimit });

  const app = express();
  if (config.trustProxy) app.set('trust proxy', 1); // behind Caddy / Nginx / Render
  app.disable('x-powered-by');

  // Room photos arrive as base64 JSON; the browser shrinks them to 1536px first.
  // Stored Final 2K images are the largest, at a few MB.
  app.use(express.json({ limit: '20mb' }));
  app.use(securityHeaders);
  // Who is asking, on every API request. Each module decides what needs a signed-in user.
  app.use('/api', authenticate(auth));

  app.use('/api', healthRoutes({ provider: studio.provider }));
  app.use('/api', authRoutes({ auth, usage, secureCookies: config.isProd }));
  app.use('/api', teamRoutes({ db, auth, usage }));
  app.use('/api', workspaceRoutes({ db, images }));
  app.use(
    '/api',
    studioRoutes({ studio, usage, quota: createQuota(config.imagesPerHour, HOUR, 'You have reached the hourly limit for images. Please try again later.') }),
  );
  app.use(
    '/api',
    assistRoutes({ assist, usage, quota: createQuota(config.assistsPerHour, HOUR, 'AI help has reached its hourly limit. Please type the details yourself for now.') }),
  );
  app.use('/api', apiNotFound);

  serveClient(app, config.distDir);
  app.use(errorHandler(showErrorDetail));
  return Object.assign(app, { auth });
}
