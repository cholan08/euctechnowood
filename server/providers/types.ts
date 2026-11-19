// Every AI image service is wrapped behind this one interface, so we can swap
// or A/B-test models (Gemini, OpenAI, FLUX, a self-hosted model...) without
// touching the rest of the app.

export interface EditInput {
  prompt: string;
  image: { mimeType: string; base64: string };
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
