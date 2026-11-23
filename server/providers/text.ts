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

/** xAI's OpenAI-compatible chat endpoint. Model ids: docs.x.ai/developers/models. */
export function createXaiText(apiKey: string, model: string): TextProvider {
  return {
    name: `xai:${model}`,
    async complete(system, user, signal) {
      const response = await fetch('https://api.x.ai/v1/chat/completions', {
        method: 'POST',
        signal,
        headers: { 'content-type': 'application/json', authorization: `Bearer ${apiKey}` },
        body: JSON.stringify({
          model,
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
