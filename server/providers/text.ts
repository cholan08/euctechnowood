import { ProviderError } from './types';

// A text model for "AI help" in the prompt bars: it turns a few rough words
// (any language) into short, clear English instructions. Kept apart from the
// image providers: it is a different endpoint, model and price.

export interface TextProvider {
  /** Shown in the API response, e.g. "xai:grok-4.20-0309-non-reasoning". */
  name: string;
  complete(system: string, user: string, signal?: AbortSignal): Promise<string>;
}

interface ChatResponse {
  choices?: { message?: { content?: string } }[];
  error?: { message?: string } | string;
}

// Text models to fall back on, cheapest and fastest first. Which ones a key can use
// depends on its xAI team (the production key's team had no grok-4.20 on 23 Nov 2026).
const XAI_FALLBACKS = [
  'grok-4.20-0309-non-reasoning',
  'grok-4.3',
  'grok-4-1-fast-non-reasoning',
  'grok-4-fast-non-reasoning',
  'grok-4.5',
  'grok-4.6',
  'grok-4.7',
  'grok-4',
  'grok-3-mini',
];

/** "model does not exist or your team does not have access to it" */
const isModelMissing = (err: unknown) => err instanceof ProviderError && (err.status === 404 || (err.status === 400 && /model/i.test(err.message)));

/**
 * xAI's OpenAI-compatible chat endpoint. Model ids: docs.x.ai/developers/models.
 * If the configured model is refused, the next ones in XAI_FALLBACKS are tried and
 * the first that answers is kept for the life of the server.
 */
export function createXaiText(apiKey: string, model: string): TextProvider {
  let current = model;
  let settled = false;

  async function chat(name: string, system: string, user: string, signal?: AbortSignal): Promise<string> {
    const response = await fetch('https://api.x.ai/v1/chat/completions', {
      method: 'POST',
      signal,
      headers: { 'content-type': 'application/json', authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model: name,
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
  }

  return {
    get name() {
      return `xai:${current}`;
    },
    async complete(system, user, signal) {
      if (settled) return chat(current, system, user, signal);
      const candidates = [model, ...XAI_FALLBACKS.filter((m) => m !== model)];
      let lastError: unknown;
      for (const name of candidates) {
        try {
          const text = await chat(name, system, user, signal);
          if (name !== model) console.warn(`[assist] ${model} is not available to this xAI key; using ${name}. Set XAI_TEXT_MODEL=${name} to skip the search.`);
          current = name;
          settled = true;
          return text;
        } catch (err) {
          if (!isModelMissing(err)) throw err;
          lastError = err;
        }
      }
      throw lastError;
    },
  };
}

interface GeminiResponse {
  candidates?: { content?: { parts?: { text?: string }[] } }[];
  error?: { message?: string };
}

/** Gemini's generateContent with a fast text model. */
export function createGeminiText(apiKey: string, model: string, apiVersion: string): TextProvider {
  const url = `https://generativelanguage.googleapis.com/${apiVersion}/models/${model}:generateContent`;
  return {
    name: `gemini:${model}`,
    async complete(system, user, signal) {
      const response = await fetch(url, {
        method: 'POST',
        signal,
        headers: { 'content-type': 'application/json', 'x-goog-api-key': apiKey },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: system }] },
          contents: [{ role: 'user', parts: [{ text: user }] }],
          generationConfig: { temperature: 0.4, maxOutputTokens: 400 },
        }),
      });
      const json = (await response.json().catch(() => ({}))) as GeminiResponse;
      if (!response.ok) throw new ProviderError(`Gemini ${response.status}: ${json.error?.message ?? response.statusText}`, response.status);
      return json.candidates?.[0]?.content?.parts?.map((p) => p.text ?? '').join('') ?? '';
    },
  };
}
