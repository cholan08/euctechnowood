import path from 'node:path';
import { fileURLToPath } from 'node:url';

// Must run before anything reads process.env. Other modules import `config`,
// so this file is always evaluated first.
try {
  process.loadEnvFile(); // reads .env if present
} catch {
  // No .env file: use the real environment.
}

const root = fileURLToPath(new URL('..', import.meta.url));
const env = process.env;
const isProd = env.NODE_ENV === 'production';

if (isProd && (!env.ADMIN_PASSWORD || !env.SESSION_SECRET)) {
  throw new Error('Set ADMIN_PASSWORD and SESSION_SECRET in the environment for production.');
}

export const config = {
  isProd,
  port: Number(env.PORT || 8787),
  trustProxy: env.TRUST_PROXY === '1',
  distDir: path.join(root, 'dist'),
  dataDir: env.DATA_DIR || path.join(root, 'data'),
  imagesPerHour: Number(env.IMAGES_PER_HOUR || 40),
  leadsPerHour: Number(env.LEADS_PER_HOUR || 10),
  adminPassword: env.ADMIN_PASSWORD || 'admin',
  sessionSecret: env.SESSION_SECRET || 'dev-only-secret-change-me',
} as const;
