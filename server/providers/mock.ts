import type { ImageEditProvider } from './types';

/** Mock: returns the uploaded photo unchanged after a short delay. For UI work and tests without an API key. */
export function createMockImageProvider(delayMs = () => 800 + Math.random() * 1200): ImageEditProvider {
  return {
    name: 'mock',
    imageRef: (index) => `<IMAGE_${index}>`,
    async edit(input) {
      await new Promise((resolve) => setTimeout(resolve, delayMs()));
      return { mimeType: input.image.mimeType, base64: input.image.base64 };
    },
  };
}
