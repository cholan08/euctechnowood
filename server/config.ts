import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { z } from 'zod';

// The only place that reads environment variables. Everything else receives the
// typed Config, so a bad value fails at startup with a clear message instead of
// on the first request. See .env.example for what each variable does.

const root = fileURLToPath(new URL('..', import.meta.url));

export type ImageProviderConfig =
  | { kind: 'mock' }
  | { kind: 'xai'; apiKey: string; model: string }
  | { kind: 'gemini'; apiKey: string; model: string; apiVersion: string; imageSize: string };

export type TextProviderConfig =
  | { kind: 'xai'; apiKey: string; model: string }
  | { kind: 'gemini'; apiKey: string; model: string; apiVersion: string };

export interface Config {
  isProd: boolean;
  port: number;
  /** Behind Nginx / Caddy / Render, so rate limits see the real visitor IP. */
  trustProxy: boolean;
  /** The built frontend (npm run build), served when it exists. */
  distDir: string;
  /** Max generated images per visitor IP per hour. Replaced by per-staff daily limits in Phase 2. */
  imagesPerHour: number;
  /** Max "AI help" requests per visitor IP per hour. Each costs about $0.001. */
  assistsPerHour: number;
  image: ImageProviderConfig;
  /** The text model behind "AI help". Null in mock mode: the server answers with built-in suggestions. */
  text: TextProviderConfig | null;
  /** Where the database file and stored images live (a Docker volume or Render disk in production). */
  dataDir: string;
  /** A session ends after this long without a request. */
  sessionIdleHours: number;
  /** Images per staff member per day, unless an admin sets their own limit. */
  dailyImageLimit: number;
  /** Creates the first admin on startup when there are no users yet (both must be set). */
  bootstrapAdmin: { email: string; password: string; name: string } | null;
}

const PROVIDERS = ['xai', 'gemini', 'mock'] as const;

const count = (fallback: number) => z.coerce.number().int().positive().default(fallback);

const EnvSchema = z.object({
  NODE_ENV: z.string().optional(),
  PORT: z.coerce.number().int().nonnegative().default(8787),
  TRUST_PROXY: z.string().optional(),
  IMAGES_PER_HOUR: count(40),
  ASSISTS_PER_HOUR: count(200),
  IMAGE_PROVIDER: z
    .string()
    .toLowerCase()
    .pipe(z.enum(PROVIDERS, { error: (issue) => `Unknown IMAGE_PROVIDER "${String(issue.input)}". Use "xai", "gemini" or "mock".` }))
    .optional(),
  XAI_API_KEY: z.string().optional(),
  XAI_IMAGE_MODEL: z.string().default('grok-imagine-image-2.0'),
  XAI_TEXT_MODEL: z.string().default('grok-4.20-0309-non-reasoning'),
  GEMINI_API_KEY: z.string().optional(),
  GEMINI_IMAGE_MODEL: z.string().default('gemini-3.1-flash-image'),
  GEMINI_API_VERSION: z.string().default('v1'),
  GEMINI_IMAGE_SIZE: z.string().default('1K'),
  GEMINI_TEXT_MODEL: z.string().default('gemini-3.5-flash-lite'),
  DATA_DIR: z.string().optional(),
  SESSION_IDLE_HOURS: count(12),
  DAILY_IMAGE_LIMIT: count(80),
  ADMIN_EMAIL: z.string().email('ADMIN_EMAIL must be an email address.').optional(),
  ADMIN_PASSWORD: z.string().min(10, 'ADMIN_PASSWORD must be at least 10 characters.').optional(),
  ADMIN_NAME: z.string().default('Studio admin'),
});

export class ConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ConfigError';
  }
}

/** Builds the Config from an environment (process.env in the app, a plain object in tests). */
export function loadConfig(env: Record<string, string | undefined>): Config {
  // An empty value in .env ("IMAGE_PROVIDER=") means "not set".
  const set = Object.fromEntries(Object.entries(env).filter(([, v]) => v !== undefined && v.trim() !== ''));
  const parsed = EnvSchema.safeParse(set);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    throw new ConfigError(`${issue.path.join('.') || 'env'}: ${issue.message}`);
  }
  const e = parsed.data;

  // IMAGE_PROVIDER, or whichever key is set.
  const provider = e.IMAGE_PROVIDER ?? (e.XAI_API_KEY ? 'xai' : e.GEMINI_API_KEY ? 'gemini' : 'mock');
  let image: ImageProviderConfig;
  let text: TextProviderConfig | null;
  switch (provider) {
    case 'xai':
      if (!e.XAI_API_KEY) throw new ConfigError('IMAGE_PROVIDER=xai needs XAI_API_KEY in .env');
      image = { kind: 'xai', apiKey: e.XAI_API_KEY, model: e.XAI_IMAGE_MODEL };
      text = { kind: 'xai', apiKey: e.XAI_API_KEY, model: e.XAI_TEXT_MODEL };
      break;
    case 'gemini':
      if (!e.GEMINI_API_KEY) throw new ConfigError('IMAGE_PROVIDER=gemini needs GEMINI_API_KEY in .env');
      image = { kind: 'gemini', apiKey: e.GEMINI_API_KEY, model: e.GEMINI_IMAGE_MODEL, apiVersion: e.GEMINI_API_VERSION, imageSize: e.GEMINI_IMAGE_SIZE };
      text = { kind: 'gemini', apiKey: e.GEMINI_API_KEY, model: e.GEMINI_TEXT_MODEL, apiVersion: e.GEMINI_API_VERSION };
      break;
    case 'mock':
      image = { kind: 'mock' };
      text = null;
      break;
  }

  return {
    isProd: e.NODE_ENV === 'production',
    port: e.PORT,
    trustProxy: e.TRUST_PROXY === '1',
    distDir: path.join(root, 'client', 'dist'),
    imagesPerHour: e.IMAGES_PER_HOUR,
    assistsPerHour: e.ASSISTS_PER_HOUR,
    image,
    text,
    dataDir: e.DATA_DIR ? path.resolve(e.DATA_DIR) : path.join(root, 'data'),
    sessionIdleHours: e.SESSION_IDLE_HOURS,
    dailyImageLimit: e.DAILY_IMAGE_LIMIT,
    bootstrapAdmin: e.ADMIN_EMAIL && e.ADMIN_PASSWORD ? { email: e.ADMIN_EMAIL.toLowerCase(), password: e.ADMIN_PASSWORD, name: e.ADMIN_NAME } : null,
  };
}
