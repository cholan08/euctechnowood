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

export const config = {
  isProd: env.NODE_ENV === 'production',
  port: Number(env.PORT || 8787),
  trustProxy: env.TRUST_PROXY === '1',
  /** The built frontend (npm run build). */
  distDir: path.join(root, 'client', 'dist'),
  /** Max generated images per visitor IP per hour. Replaced by per-staff daily limits in Phase 2. */
  imagesPerHour: Number(env.IMAGES_PER_HOUR || 40),
} as const;
