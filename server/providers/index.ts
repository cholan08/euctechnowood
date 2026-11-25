import type { ImageProviderConfig, TextProviderConfig } from '../config';
import { createGeminiImageProvider } from './gemini/image';
import { createGeminiTextProvider } from './gemini/text';
import { createMockImageProvider } from './mock';
import type { ImageEditProvider, Providers, TextProvider } from './types';
import { createXaiImageProvider } from './xai/image';
import { createXaiTextProvider } from './xai/text';

// The one place that knows which adapters exist. To add a service, create
// providers/<name>/image.ts (and text.ts), add its settings to config.ts, and
// add a case here.

export function createImageProvider(config: ImageProviderConfig): ImageEditProvider {
  switch (config.kind) {
    case 'xai':
      return createXaiImageProvider(config);
    case 'gemini':
      return createGeminiImageProvider(config);
    case 'mock':
      return createMockImageProvider();
  }
}

export function createTextProvider(config: TextProviderConfig | null): TextProvider | null {
  switch (config?.kind) {
    case 'xai':
      return createXaiTextProvider(config);
    case 'gemini':
      return createGeminiTextProvider(config);
    default:
      return null;
  }
}

export function createProviders(config: { image: ImageProviderConfig; text: TextProviderConfig | null }): Providers {
  return { image: createImageProvider(config.image), text: createTextProvider(config.text) };
}
