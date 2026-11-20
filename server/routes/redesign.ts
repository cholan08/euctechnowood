import { Router } from 'express';
import { randomUUID } from 'node:crypto';
import type { RedesignResponse, Variation } from '../../shared/types';
import { config } from '../config';
import { getProvider } from '../providers';
import { ProviderError } from '../providers/types';
import { buildJobs } from '../services/prompt';
import { RateLimiter } from '../services/rateLimiter';
import { parseRedesignRequest, RequestError, type ParsedRequest } from '../services/validate';

const provider = getProvider();
const quota = new RateLimiter(config.imagesPerHour, 60 * 60 * 1000);

export const redesignRouter = Router();

redesignRouter.get('/health', (_req, res) => {
  res.json({ ok: true, provider: provider.name });
});

redesignRouter.post('/redesign', async (req, res) => {
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
  // Nothing is written to disk: each image goes straight back to the browser.
  const variations = await Promise.all(
    jobs.map(async (job): Promise<Variation> => {
      const started = Date.now();
      const base = { id: randomUUID(), label: job.label, styleId: job.styleId, prompt: job.prompt };
      try {
        const out = await provider.edit(
          { prompt: job.prompt, image: input.image, width: input.width, height: input.height },
          AbortSignal.timeout(120_000),
        );
        return { ...base, image: `data:${out.mimeType};base64,${out.base64}`, ms: Date.now() - started };
      } catch (err) {
        console.error(`[redesign] "${job.label}" failed:`, err);
        return { ...base, error: describeError(err), ms: Date.now() - started };
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
  return !config.isProd && err instanceof Error ? err.message : 'This design could not be generated. Please try again.';
}
