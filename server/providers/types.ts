// Every AI image service is wrapped behind this one interface, so we can swap
// or A/B-test models (Gemini, OpenAI, FLUX, a self-hosted model...) without
// touching the rest of the app.

export interface ImageData {
  mimeType: string;
  base64: string;
}

export interface EditInput {
  prompt: string;
  /** The room photo or render being edited. */
  image: ImageData;
  /** Extra images sent after the room photo, e.g. photos of material samples to match. */
  references?: ImageData[];
  width: number;
  height: number;
}

export interface EditOutput {
  mimeType: string;
  base64: string;
}

export interface ImageEditProvider {
  /** Shown in logs and the UI, e.g. "gemini:gemini-3.1-flash-image". */
  name: string;
  /**
   * How a prompt names an input image: 0 is the room photo, 1+ the references in order.
   * Each service has its own convention (xAI: "<IMAGE_1>").
   */
  imageRef(index: number): string;
  edit(input: EditInput, signal?: AbortSignal): Promise<EditOutput>;
}

export class ProviderError extends Error {
  readonly status: number | undefined;
  /** The service refused the request on safety or policy grounds. */
  readonly blocked: boolean;

  constructor(message: string, status?: number, blocked = false) {
    super(message);
    this.name = 'ProviderError';
    this.status = status;
    this.blocked = blocked;
  }
}
