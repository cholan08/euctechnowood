import { randomUUID } from 'node:crypto';
import type { EditResponse, FinalResponse, GenerateResponse, RedesignResponse, Variation } from '@shared/types';
import { AppError, describeAiFailure } from '../../lib/errors';
import { toDataUrl } from '../../lib/image';
import type { EditInput, ImageEditProvider } from '../../providers/types';
import { buildEditPrompt, buildFinalPrompt, buildGenerateJobs, buildJobs, type Job } from './studio.prompts';
import type { ParsedEdit, ParsedFinal, ParsedGenerate, ParsedRedesign } from './studio.schema';

// The studio's use cases: turn a checked request into prompts, call the image AI,
// and shape the answer. Nothing is written to disk: every image goes straight
// back to the browser.

const TIMEOUT_MS = 120_000;

export interface StudioService {
  /** The image AI's name, for /api/health and the UI. */
  readonly provider: string;
  /** Mark & edit: one change to one marked area. The browser pastes back only that area. */
  edit(input: ParsedEdit): Promise<EditResponse>;
  /** Standard: options A–D, one image each, made in parallel. One failing does not fail the others. */
  redesign(input: ParsedRedesign): Promise<RedesignResponse>;
  /** Final 2K: one realism pass over the finished image, at the AI's 2K size. */
  final(input: ParsedFinal): Promise<FinalResponse>;
  /** Generate: an empty room photo → 1–4 designed concepts, made in parallel. */
  generate(input: ParsedGenerate): Promise<GenerateResponse>;
}

interface Deps {
  image: ImageEditProvider;
  /** Show the AI service's own error messages (development only). */
  showErrorDetail: boolean;
  timeoutMs?: number;
}

export function createStudioService({ image, showErrorDetail, timeoutMs = TIMEOUT_MS }: Deps): StudioService {
  /** One AI edit; a failure becomes a 502 with a message staff can read. */
  async function editOne(input: EditInput, what: string, fallback: string): Promise<EditResponse> {
    const started = Date.now();
    try {
      const out = await image.edit(input, AbortSignal.timeout(timeoutMs));
      return { image: toDataUrl(out), prompt: input.prompt, ms: Date.now() - started, provider: image.name };
    } catch (err) {
      console.error(`[${what}] failed:`, err);
      throw new AppError(502, describeAiFailure(err, fallback, showErrorDetail));
    }
  }

  /** Several images at once (options A–D, concepts), in parallel. One failing does not fail the others. */
  function runJobs(jobs: Job[], input: { image: EditInput['image']; width: number; height: number }, what: string, fallback: string): Promise<Variation[]> {
    return Promise.all(
      jobs.map(async (job): Promise<Variation> => {
        const started = Date.now();
        const base = { id: randomUUID(), label: job.label, specs: job.specs, prompt: job.prompt };
        try {
          const out = await image.edit(
            { prompt: job.prompt, image: input.image, references: job.references, width: input.width, height: input.height },
            AbortSignal.timeout(timeoutMs),
          );
          return { ...base, image: toDataUrl(out), ms: Date.now() - started };
        } catch (err) {
          console.error(`[${what}] "${job.label}" failed:`, err);
          return { ...base, error: describeAiFailure(err, fallback, showErrorDetail), ms: Date.now() - started };
        }
      }),
    );
  }

  return {
    provider: image.name,

    edit(input) {
      const prompt = buildEditPrompt(input, image.imageRef);
      const references = input.reference ? [input.reference] : undefined;
      const what = `edit ${input.action !== 'change' ? input.action : input.reference ? 'item photo' : (input.element?.id ?? 'own words')}`;
      return editOne(
        { prompt, image: input.image, references, width: input.width, height: input.height },
        what,
        'This change could not be made. Please try again.',
      );
    },

    async redesign(input) {
      return { provider: image.name, variations: await runJobs(buildJobs(input, image.imageRef), input, 'redesign', 'This design could not be generated. Please try again.') };
    },

    async generate(input) {
      return { provider: image.name, concepts: await runJobs(buildGenerateJobs(input), input, 'generate', 'This concept could not be generated. Please try again.') };
    },

    final(input) {
      const prompt = buildFinalPrompt(input);
      return editOne(
        { prompt, image: input.image, width: input.width, height: input.height, resolution: '2k' },
        'final',
        'The final image could not be made. Please try again.',
      );
    },
  };
}
