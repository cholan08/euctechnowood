import { createGeminiProvider } from './gemini';
import type { ImageEditProvider } from './types';

/** Mock: returns the uploaded photo unchanged after a short delay. For UI work without an API key. */
const mockProvider: ImageEditProvider = {
  name: 'mock',
  async edit(input) {
    await new Promise((resolve) => setTimeout(resolve, 800 + Math.random() * 1200));
    return { mimeType: input.image.mimeType, base64: input.image.base64 };
  },
};

/** Reads the environment when called, so call it after .env is loaded. */
export function getProvider(): ImageEditProvider {
  const env = process.env;
  const name = (env.IMAGE_PROVIDER || (env.GEMINI_API_KEY ? 'gemini' : 'mock')).toLowerCase();

  switch (name) {
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
      throw new Error(`Unknown IMAGE_PROVIDER "${name}". Use "gemini" or "mock".`);
  }
}
