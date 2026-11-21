import { createGeminiProvider } from './gemini';
import type { ImageEditProvider } from './types';
import { createXaiProvider } from './xai';

/** Mock: returns the uploaded photo unchanged after a short delay. For UI work without an API key. */
const mockProvider: ImageEditProvider = {
  name: 'mock',
  imageRef: (index) => `<IMAGE_${index}>`,
  async edit(input) {
    await new Promise((resolve) => setTimeout(resolve, 800 + Math.random() * 1200));
    return { mimeType: input.image.mimeType, base64: input.image.base64 };
  },
};

/** Reads the environment when called, so call it after config has loaded .env. */
export function getProvider(): ImageEditProvider {
  const env = process.env;
  const fallback = env.XAI_API_KEY ? 'xai' : env.GEMINI_API_KEY ? 'gemini' : 'mock';
  const name = (env.IMAGE_PROVIDER || fallback).toLowerCase();

  switch (name) {
    case 'xai': {
      if (!env.XAI_API_KEY) throw new Error('IMAGE_PROVIDER=xai needs XAI_API_KEY in .env');
      return createXaiProvider({ apiKey: env.XAI_API_KEY, model: env.XAI_IMAGE_MODEL || 'grok-imagine-image-2.0' });
    }
    case 'gemini': {
      if (!env.GEMINI_API_KEY) throw new Error('IMAGE_PROVIDER=gemini needs GEMINI_API_KEY in .env');
      return createGeminiProvider({
        apiKey: env.GEMINI_API_KEY,
        model: env.GEMINI_IMAGE_MODEL || 'gemini-3.1-flash-image',
        apiVersion: env.GEMINI_API_VERSION || 'v1',
        imageSize: env.GEMINI_IMAGE_SIZE || '1K',
      });
    }
    case 'mock':
      return mockProvider;
    default:
      throw new Error(`Unknown IMAGE_PROVIDER "${name}". Use "xai", "gemini" or "mock".`);
  }
}
