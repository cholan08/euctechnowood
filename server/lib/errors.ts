// Error types shared by every layer. Only an AppError's message is ever shown to
// staff; anything else becomes a generic "Server error." in production.

/** An error with a message that is safe to show staff, and the HTTP status to answer with. */
export class AppError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = 'AppError';
  }
}

/** A problem with what the browser sent (400). */
export class RequestError extends AppError {
  constructor(message: string) {
    super(400, message);
    this.name = 'RequestError';
  }
}

/** An AI service answered with an error, or with no usable result. Its message is for the logs, not for staff. */
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

/**
 * Turns a failed AI call into a message staff can act on. With `showDetail`
 * (development) the real reason is shown; in production provider details stay private.
 */
export function describeAiFailure(err: unknown, fallback: string, showDetail: boolean): string {
  if (err instanceof ProviderError) {
    if (err.status === 429) return 'The AI service is busy or out of quota. Please try again shortly.';
    if (err.blocked) return 'The AI service declined this image. Try a different photo.';
  }
  if (err instanceof Error && err.name === 'TimeoutError') return 'The AI service took too long. Please try again.';
  return showDetail && err instanceof Error ? err.message : fallback;
}
