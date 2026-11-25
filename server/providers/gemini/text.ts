import { ProviderError } from '../../lib/errors';
import type { TextProvider } from '../types';

interface GeminiResponse {
  candidates?: { content?: { parts?: { text?: string }[] } }[];
  error?: { message?: string };
}

export interface GeminiTextConfig {
  apiKey: string;
  model: string;
  apiVersion: string;
}

/** Gemini's generateContent with a fast text model, for "AI help" in the prompt bars. */
export function createGeminiTextProvider({ apiKey, model, apiVersion }: GeminiTextConfig): TextProvider {
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
