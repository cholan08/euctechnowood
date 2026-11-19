import { ProviderError, type EditInput, type EditOutput, type ImageEditProvider } from './types';

// Google Gemini image models ("Nano Banana" family) edit an image from a text
// instruction through the generateContent endpoint.
// Docs: https://ai.google.dev/gemini-api/docs/image-generation
// Model ids change often; set GEMINI_IMAGE_MODEL in .env rather than editing code.

export interface GeminiConfig {
  apiKey: string;
  model: string;
  apiVersion: string;
  /** "1K", "2K" or "4K". Larger costs more per image. */
  imageSize: string;
}

const ASPECT_RATIOS = ['1:1', '2:3', '3:2', '3:4', '4:3', '4:5', '5:4', '9:16', '16:9', '21:9'];

/** Gemini only outputs fixed aspect ratios; pick the one closest to the photo. */
export function nearestAspectRatio(width: number, height: number): string {
  const target = Math.log(width / height);
  let best = '1:1';
  let bestDiff = Infinity;
  for (const ratio of ASPECT_RATIOS) {
    const [w, h] = ratio.split(':').map(Number);
    const diff = Math.abs(Math.log(w / h) - target);
    if (diff < bestDiff) {
      best = ratio;
      bestDiff = diff;
    }
  }
  return best;
}

interface InlineData {
  mimeType?: string;
  mime_type?: string;
  data?: string;
}

interface Part {
  text?: string;
  inlineData?: InlineData;
  inline_data?: InlineData;
}

interface GenerateContentResponse {
  candidates?: { content?: { parts?: Part[] }; finishReason?: string }[];
  promptFeedback?: { blockReason?: string };
  error?: { message?: string };
}

export function createGeminiProvider(config: GeminiConfig): ImageEditProvider {
  const url = `https://generativelanguage.googleapis.com/${config.apiVersion}/models/${config.model}:generateContent`;

  return {
    name: `gemini:${config.model}`,

    async edit(input: EditInput, signal?: AbortSignal): Promise<EditOutput> {
      const response = await fetch(url, {
        method: 'POST',
        signal,
        headers: { 'content-type': 'application/json', 'x-goog-api-key': config.apiKey },
        body: JSON.stringify({
          contents: [
            {
              role: 'user',
              parts: [
                { text: input.prompt },
                { inline_data: { mime_type: input.image.mimeType, data: input.image.base64 } },
              ],
            },
          ],
          generationConfig: {
            responseModalities: ['TEXT', 'IMAGE'],
            imageConfig: {
              aspectRatio: nearestAspectRatio(input.width, input.height),
              imageSize: config.imageSize,
            },
          },
        }),
      });

      const json = (await response.json().catch(() => ({}))) as GenerateContentResponse;
      if (!response.ok) {
        throw new ProviderError(
          `Gemini ${response.status}: ${json.error?.message ?? response.statusText}`,
          response.status,
        );
      }

      const candidate = json.candidates?.[0];
      const parts = candidate?.content?.parts ?? [];
      for (const part of parts) {
        const inline = part.inlineData ?? part.inline_data;
        if (inline?.data) {
          return { mimeType: inline.mimeType ?? inline.mime_type ?? 'image/png', base64: inline.data };
        }
      }

      // No image: usually a safety refusal, or the model answered with text only.
      const reason = json.promptFeedback?.blockReason ?? candidate?.finishReason ?? 'no image returned';
      const blocked = Boolean(json.promptFeedback?.blockReason) || /SAFETY|PROHIBITED|BLOCK/i.test(reason);
      const text = parts
        .map((p) => p.text)
        .filter(Boolean)
        .join(' ')
        .slice(0, 200);
      throw new ProviderError(`Gemini returned no image (${reason})${text ? `: ${text}` : ''}`, 200, blocked);
    },
  };
}
