import { Router, type Request, type Response } from 'express';
import { randomUUID } from 'node:crypto';
import type { AssistResponse, EditResponse, RedesignResponse, Variation } from '../../shared/types';
import { config } from '../config';
import { getProvider, getTextProvider } from '../providers';
import { ProviderError, type EditInput } from '../providers/types';
import { assistMessage, assistSystem, localSuggestions, parseSuggestions } from '../services/assist';
import { buildEditPrompt, buildFinalPrompt, buildJobs } from '../services/prompt';
import { RateLimiter } from '../services/rateLimiter';
import { parseAssistRequest, parseEditRequest, parseFinalRequest, parseRedesignRequest, RequestError } from '../services/validate';

const provider = getProvider();
const textProvider = getTextProvider();
const quota = new RateLimiter(config.imagesPerHour, 60 * 60 * 1000);
const assistQuota = new RateLimiter(config.assistsPerHour, 60 * 60 * 1000);
const TIMEOUT_MS = 120_000;

// Nothing is written to disk anywhere here: every image goes straight back to the browser.
export const studioRouter = Router();

studioRouter.get('/health', (_req, res) => {
  res.json({ ok: true, provider: provider.name });
});

/** Parses the body, answering 400 with a message staff can read when it is wrong. */
function parseOr400<T>(req: Request, res: Response, parse: (body: unknown) => T): T | null {
  try {
    return parse(req.body);
  } catch (err) {
    if (err instanceof RequestError) {
      res.status(400).json({ error: err.message });
      return null;
    }
    throw err;
  }
}

function takeQuota(req: Request, res: Response, images: number): boolean {
  if (quota.take(req.ip ?? 'unknown', images)) return true;
  res.status(429).json({ error: 'You have reached the hourly limit for images. Please try again later.' });
  return false;
}

/** One AI edit, answered as EditResponse (or 502 with a readable reason). */
async function editOne(res: Response, input: EditInput, what: string, fallback: string) {
  const started = Date.now();
  try {
    const out = await provider.edit(input, AbortSignal.timeout(TIMEOUT_MS));
    const body: EditResponse = { image: `data:${out.mimeType};base64,${out.base64}`, prompt: input.prompt, ms: Date.now() - started, provider: provider.name };
    res.json(body);
  } catch (err) {
    console.error(`[${what}] failed:`, err);
    res.status(502).json({ error: describeError(err, fallback) });
  }
}

/** Mark & edit: one change to one marked area. The browser pastes back only that area. */
studioRouter.post('/edit', async (req, res) => {
  const input = parseOr400(req, res, parseEditRequest);
  if (!input || !takeQuota(req, res, 1)) return;
  const prompt = buildEditPrompt(input, provider.imageRef);
  const references = input.reference ? [input.reference] : undefined;
  const what = `edit ${input.reference ? 'item photo' : (input.element?.id ?? 'own words')}`;
  await editOne(res, { prompt, image: input.image, references, width: input.width, height: input.height }, what, 'This change could not be made. Please try again.');
});

/** Standard: options A–D, one image each, all made in parallel. */
studioRouter.post('/redesign', async (req, res) => {
  const input = parseOr400(req, res, parseRedesignRequest);
  if (!input) return;
  const jobs = buildJobs(input, provider.imageRef);
  if (!takeQuota(req, res, jobs.length)) return;

  // One option failing does not fail the others.
  const variations = await Promise.all(
    jobs.map(async (job): Promise<Variation> => {
      const started = Date.now();
      const base = { id: randomUUID(), label: job.label, specs: job.specs, prompt: job.prompt };
      try {
        const out = await provider.edit(
          { prompt: job.prompt, image: input.image, references: job.references, width: input.width, height: input.height },
          AbortSignal.timeout(TIMEOUT_MS),
        );
        return { ...base, image: `data:${out.mimeType};base64,${out.base64}`, ms: Date.now() - started };
      } catch (err) {
        console.error(`[redesign] "${job.label}" failed:`, err);
        return { ...base, error: describeError(err, 'This design could not be generated. Please try again.'), ms: Date.now() - started };
      }
    }),
  );

  const body: RedesignResponse = { provider: provider.name, variations };
  res.json(body);
});

/** Final 2K: one realism pass over the finished image, at the AI's 2K size. */
studioRouter.post('/final', async (req, res) => {
  const input = parseOr400(req, res, parseFinalRequest);
  if (!input || !takeQuota(req, res, 1)) return;
  const prompt = buildFinalPrompt(input);
  await editOne(res, { prompt, image: input.image, width: input.width, height: input.height, resolution: '2k' }, 'final', 'The final image could not be made. Please try again.');
});

/** AI help for a prompt bar: up to three clear English versions of what staff typed. No image is made. */
studioRouter.post('/assist', async (req, res) => {
  const input = parseOr400(req, res, parseAssistRequest);
  if (!input) return;
  if (!assistQuota.take(req.ip ?? 'unknown', 1)) {
    res.status(429).json({ error: 'AI help has reached its hourly limit. Please type the details yourself for now.' });
    return;
  }
  if (!textProvider) {
    const body: AssistResponse = { suggestions: localSuggestions(input), provider: 'mock' };
    res.json(body);
    return;
  }
  try {
    // Generous: if the key only has a reasoning model, it thinks before answering.
    const raw = await textProvider.complete(assistSystem(), assistMessage(input), AbortSignal.timeout(45_000));
    const suggestions = parseSuggestions(raw, input.kind);
    if (!suggestions.length) throw new Error(`No suggestions in the answer: ${raw.slice(0, 200)}`);
    const body: AssistResponse = { suggestions, provider: textProvider.name };
    res.json(body);
  } catch (err) {
    console.error('[assist] failed:', err);
    res.status(502).json({ error: describeError(err, 'AI help is not available right now. Please type the details yourself.') });
  }
});

function describeError(err: unknown, fallback: string): string {
  if (err instanceof ProviderError) {
    if (err.status === 429) return 'The AI service is busy or out of quota. Please try again shortly.';
    if (err.blocked) return 'The AI service declined this image. Try a different photo.';
  }
  if (err instanceof Error && err.name === 'TimeoutError') return 'The AI service took too long. Please try again.';
  // In development show the real reason; in production keep provider details private.
  return !config.isProd && err instanceof Error ? err.message : fallback;
}
