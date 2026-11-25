import type { AssistResponse, RecommendResponse } from '@shared/types';
import { AppError, describeAiFailure } from '../../lib/errors';
import type { TextProvider } from '../../providers/types';
import { assistMessage, assistSystem, localSuggestions, parseSuggestions } from './assist.prompts';
import type { ParsedAssist } from './assist.schema';
import { localRecommendations, parseFurniture, RECOMMEND_SYSTEM, recommendMessage, type ParsedRecommend } from './recommend';

// Generous: if the key only has a reasoning model, it thinks before answering.
const TIMEOUT_MS = 45_000;

export interface AssistService {
  /** Up to three clear English versions of what staff typed. No image is made. */
  suggest(input: ParsedAssist): Promise<AssistResponse>;
  /** Furniture for a room in a style. Falls back to the built-in list if the AI fails. */
  recommend(input: ParsedRecommend): Promise<RecommendResponse>;
  /** The text model's name, or "mock". */
  readonly provider: string;
}

interface Deps {
  /** Null in mock mode: simple built-in suggestions instead. */
  text: TextProvider | null;
  showErrorDetail: boolean;
  timeoutMs?: number;
}

export function createAssistService({ text, showErrorDetail, timeoutMs = TIMEOUT_MS }: Deps): AssistService {
  return {
    provider: text?.name ?? 'mock',

    async recommend(input) {
      if (!text) return { items: localRecommendations(input), provider: 'mock' };
      try {
        const raw = await text.complete(RECOMMEND_SYSTEM, recommendMessage(input), AbortSignal.timeout(timeoutMs));
        const items = parseFurniture(raw);
        if (items.length < 3) throw new Error(`Too few items in the answer: ${raw.slice(0, 200)}`);
        return { items, provider: text.name };
      } catch (err) {
        // Recommendations are a convenience: the built-in list is a fine answer.
        console.error('[recommend] failed, using the built-in list:', err);
        return { items: localRecommendations(input), provider: 'built-in' };
      }
    },

    async suggest(input) {
      if (!text) return { suggestions: localSuggestions(input), provider: 'mock' };
      try {
        const raw = await text.complete(assistSystem(), assistMessage(input), AbortSignal.timeout(timeoutMs));
        const suggestions = parseSuggestions(raw, input.kind);
        if (!suggestions.length) throw new Error(`No suggestions in the answer: ${raw.slice(0, 200)}`);
        return { suggestions, provider: text.name };
      } catch (err) {
        console.error('[assist] failed:', err);
        throw new AppError(502, describeAiFailure(err, 'AI help is not available right now. Please type the details yourself.', showErrorDetail));
      }
    },
  };
}
