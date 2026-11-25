import type { ImageData } from '../lib/image';

// Every AI service is wrapped behind these interfaces, so we can swap or A/B-test
// models (Gemini, OpenAI, FLUX, a self-hosted model...) without touching the rest
// of the app. Adapters throw ProviderError (lib/errors) when a call fails.

export type { ImageData };

export interface EditInput {
  prompt: string;
  /** The room photo or render being edited. */
  image: ImageData;
  /** Extra images sent after the room photo, e.g. photos of material samples to match. */
  references?: ImageData[];
  width: number;
  height: number;
  /** Output size. Omitted = the service's default (about 1K); "2k" for the final image. */
  resolution?: '2k';
}

export type EditOutput = ImageData;

/** How a prompt names input image n: 0 is the room photo, 1+ the references in order. */
export type ImageRef = (index: number) => string;

export interface ImageEditProvider {
  /** Shown in logs and the UI, e.g. "gemini:gemini-3.1-flash-image". */
  readonly name: string;
  /** Each service has its own convention for naming images in a prompt (xAI: "<IMAGE_1>"). */
  imageRef: ImageRef;
  edit(input: EditInput, signal?: AbortSignal): Promise<EditOutput>;
}

/**
 * A text model for "AI help" in the prompt bars: it turns a few rough words (any
 * language) into short, clear English instructions. Kept apart from the image
 * providers: it is a different endpoint, model and price.
 */
export interface TextProvider {
  /** Shown in the API response, e.g. "xai:grok-4.20-0309-non-reasoning". */
  readonly name: string;
  complete(system: string, user: string, signal?: AbortSignal): Promise<string>;
}

/** The AI services the app runs with. `text` is null in mock mode. */
export interface Providers {
  image: ImageEditProvider;
  text: TextProvider | null;
}
