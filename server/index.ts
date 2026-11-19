import express, { type NextFunction, type Request, type Response } from 'express';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import type { RedesignResponse, Variation } from '../shared/types';
import { buildJobs } from './prompt';
import { getProvider } from './providers';
import { ProviderError } from './providers/types';
import { ImageQuota } from './quota';
import { parseRedesignRequest, RequestError, type ParsedRequest } from './validate';

try {
  process.loadEnvFile(); // reads .env if present
} catch {
  // No .env file: use the real environment.
}

const provider = getProvider();
const quota = new ImageQuota(Number(process.env.IMAGES_PER_HOUR || 40), 60 * 60 * 1000);
const isDev = process.env.NODE_ENV !== 'production';
const app = express();

// Room photos arrive as base64 JSON; the browser shrinks them to 1536px first.
app.use(express.json({ limit: '15mb' }));

app.get('/api/health', (_req, res) => {
  res.json({ ok: true, provider: provider.name });
});

app.post('/api/redesign', async (req, res) => {
  let input: ParsedRequest;
  try {
    input = parseRedesignRequest(req.body);
  } catch (err) {
    if (err instanceof RequestError) {
      res.status(400).json({ error: err.message });
      return;
    }
    throw err;
  }

  const jobs = buildJobs(input);
  if (!quota.take(req.ip ?? 'unknown', jobs.length)) {
    res.status(429).json({ error: 'You have reached the hourly limit for designs. Please try again later.' });
    return;
  }

  // All variations run in parallel; one failing does not fail the others.
  const variations = await Promise.all(
    jobs.map(async (job): Promise<Variation> => {
      const started = Date.now();
      try {
        const out = await provider.edit(
          { prompt: job.prompt, image: input.image, width: input.width, height: input.height },
          AbortSignal.timeout(120_000),
        );
        return { ...job, image: `data:${out.mimeType};base64,${out.base64}`, ms: Date.now() - started };
      } catch (err) {
        console.error(`[redesign] "${job.label}" failed:`, err);
        return { ...job, error: describeError(err), ms: Date.now() - started };
      }
    }),
  );

  const body: RedesignResponse = { provider: provider.name, variations };
  res.json(body);
});

function describeError(err: unknown): string {
  if (err instanceof ProviderError) {
    if (err.status === 429) return 'The AI service is busy or out of quota. Please try again shortly.';
    if (err.blocked) return 'The AI service declined this image. Try a different photo.';
  }
  if (err instanceof Error && err.name === 'TimeoutError') return 'The AI service took too long. Please try again.';
  // In development show the real reason; in production keep provider details private.
  return isDev && err instanceof Error ? err.message : 'This design could not be generated. Please try again.';
}

// In production, serve the built frontend (npm run build) from the same server.
const dist = fileURLToPath(new URL('../dist', import.meta.url));
if (existsSync(dist)) app.use(express.static(dist));

app.use((err: { status?: number }, _req: Request, res: Response, _next: NextFunction) => {
  const status = err.status ?? 500;
  if (status >= 500) console.error(err);
  res.status(status).json({
    error: status === 413 ? 'That image is too large.' : status < 500 ? 'Bad request.' : 'Server error.',
  });
});

const port = Number(process.env.PORT || 8787);
app.listen(port, () => {
  console.log(`Room Studio API on http://localhost:${port} (provider: ${provider.name})`);
});
