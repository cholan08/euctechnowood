import { ProviderError } from '../../lib/errors';
import type { TextProvider } from '../types';

// xAI's OpenAI-compatible chat endpoint, for "AI help" in the prompt bars.

export interface XaiTextConfig {
  apiKey: string;
  model: string;
}

interface ChatResponse {
  choices?: { message?: { content?: string } }[];
  error?: { message?: string } | string;
}

interface LanguageModel {
  id: string;
  aliases?: string[];
  output_modalities?: string[];
  completion_text_token_price?: number;
}

/**
 * Which text model to use with this key. Each xAI team can use different models (the
 * production key's team had no grok-4.20-0309-non-reasoning on 23 Nov 2026), so ask
 * xAI which ones this key has and pick: the configured one, else a non-reasoning one
 * (fast), else a "fast" or "mini" one, else the cheapest; multi-agent models last.
 */
async function pickXaiModel(apiKey: string, wanted: string): Promise<string> {
  const response = await fetch('https://api.x.ai/v1/language-models', { headers: { authorization: `Bearer ${apiKey}` } });
  if (!response.ok) throw new ProviderError(`xAI ${response.status}: could not list language models`, response.status);
  const json = (await response.json().catch(() => ({}))) as { models?: LanguageModel[]; data?: LanguageModel[] };
  const models = (json.models ?? json.data ?? []).filter((m) => !m.output_modalities || m.output_modalities.includes('text'));
  const names = (m: LanguageModel) => [m.id, ...(m.aliases ?? [])];
  const has = (pattern: RegExp) => models.find((m) => names(m).some((n) => pattern.test(n)));
  const price = (m: LanguageModel) => m.completion_text_token_price ?? Number.MAX_SAFE_INTEGER;
  const cheapest = [...models].sort((a, b) => Number(/multi-agent/.test(a.id)) - Number(/multi-agent/.test(b.id)) || price(a) - price(b))[0];
  const pick = models.find((m) => names(m).includes(wanted)) ?? has(/non-reasoning/) ?? has(/fast|mini/) ?? cheapest;
  console.log(`[assist] text models for this xAI key: ${models.map((m) => m.id).join(', ') || 'none'}; using ${pick?.id ?? 'none'}`);
  if (!pick) throw new ProviderError('This xAI key has no text model for AI help.', 404);
  // Keep the name staff configured when it is an alias of the pick.
  return names(pick).includes(wanted) ? wanted : pick.id;
}

/** xAI's OpenAI-compatible chat endpoint. The model is chosen once, on the first request (see pickXaiModel). */
export function createXaiTextProvider({ apiKey, model }: XaiTextConfig): TextProvider {
  let current = model;
  let choosing: Promise<string> | null = null;

  async function chosen(): Promise<string> {
    choosing ??= pickXaiModel(apiKey, model).catch((err) => {
      choosing = null; // try again on the next request
      console.error('[assist] could not choose a text model, trying the configured one:', err);
      return model;
    });
    current = await choosing;
    return current;
  }

  return {
    get name() {
      return `xai:${current}`;
    },
    async complete(system, user, signal) {
      const response = await fetch('https://api.x.ai/v1/chat/completions', {
        method: 'POST',
        signal,
        headers: { 'content-type': 'application/json', authorization: `Bearer ${apiKey}` },
        body: JSON.stringify({
          model: await chosen(),
          messages: [
            { role: 'system', content: system },
            { role: 'user', content: user },
          ],
          temperature: 0.4,
          max_tokens: 400,
        }),
      });
      const json = (await response.json().catch(() => ({}))) as ChatResponse;
      if (!response.ok) {
        const detail = typeof json.error === 'string' ? json.error : json.error?.message;
        throw new ProviderError(`xAI ${response.status}: ${detail ?? response.statusText}`, response.status);
      }
      return json.choices?.[0]?.message?.content ?? '';
    },
  };
}
