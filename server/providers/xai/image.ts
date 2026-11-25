import { ProviderError } from '../../lib/errors';
import type { EditInput, EditOutput, ImageData, ImageEditProvider } from '../types';

// xAI "Grok Imagine" edits an image from a text instruction.
// Docs: https://docs.x.ai/developers/model-capabilities/images/editing
// Note: "grok-4.x" are chat models and cannot make images; the image model is
// grok-imagine-image-2.0. The edit endpoint takes JSON (not multipart), so the
// OpenAI SDK's images.edit() does not work: we call it with fetch.

export interface XaiImageConfig {
  apiKey: string;
  model: string;
}

interface EditResponse {
  data?: { url?: string; b64_json?: string; mime_type?: string }[];
  error?: { message?: string } | string;
}

const asImage = (img: ImageData) => ({ type: 'image_url', url: `data:${img.mimeType};base64,${img.base64}` });

export function createXaiImageProvider(config: XaiImageConfig): ImageEditProvider {
  return {
    name: `xai:${config.model}`,

    // Multi-image edits take up to five images, named <IMAGE_0>, <IMAGE_1>... in the prompt.
    // Docs: https://docs.x.ai/developers/model-capabilities/images/multi-image-editing
    imageRef: (index) => `<IMAGE_${index}>`,

    async edit(input: EditInput, signal?: AbortSignal): Promise<EditOutput> {
      // `image` and `images` are mutually exclusive; the room photo goes first so the output follows its aspect ratio.
      const images = input.references?.length ? { images: [input.image, ...input.references].map(asImage) } : { image: asImage(input.image) };
      const response = await fetch('https://api.x.ai/v1/images/edits', {
        method: 'POST',
        signal,
        headers: { 'content-type': 'application/json', authorization: `Bearer ${config.apiKey}` },
        // `resolution` is "1k" (default) or "2k"; both cost the same per image (docs.x.ai pricing, Nov 2026).
        body: JSON.stringify({ model: config.model, prompt: input.prompt, ...images, ...(input.resolution && { resolution: input.resolution }) }),
      });

      const json = (await response.json().catch(() => ({}))) as EditResponse;
      if (!response.ok) {
        const detail = typeof json.error === 'string' ? json.error : json.error?.message;
        const blocked = /moderation|safety|policy|content/i.test(detail ?? '');
        throw new ProviderError(`xAI ${response.status}: ${detail ?? response.statusText}`, response.status, blocked);
      }

      const item = json.data?.[0];
      if (item?.b64_json) return { mimeType: item.mime_type ?? 'image/jpeg', base64: item.b64_json };

      if (item?.url) {
        // Result URLs are temporary, so download the image now.
        const image = await fetch(item.url, { signal });
        if (!image.ok) throw new ProviderError(`xAI image download failed (${image.status})`, image.status);
        const mimeType = image.headers.get('content-type')?.split(';')[0] || 'image/jpeg';
        return { mimeType, base64: Buffer.from(await image.arrayBuffer()).toString('base64') };
      }

      throw new ProviderError('xAI returned no image', 200);
    },
  };
}
