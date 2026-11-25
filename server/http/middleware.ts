import type { ErrorRequestHandler, RequestHandler } from 'express';
import { AppError } from '../lib/errors';

export const securityHeaders: RequestHandler = (_req, res, next) => {
  res.setHeader('x-content-type-options', 'nosniff');
  res.setHeader('x-frame-options', 'DENY');
  res.setHeader('referrer-policy', 'same-origin');
  next();
};

/** Unknown /api routes answer JSON, never the app's index.html. */
export const apiNotFound: RequestHandler = (_req, res) => {
  res.status(404).json({ error: 'Not found.' });
};

/**
 * The one place errors become responses: `{ error }` with a message staff can read.
 * AppError messages are shown as they are; anything else is hidden in production.
 */
export function errorHandler(showDetail: boolean): ErrorRequestHandler {
  return (err: { status?: number; message?: string }, _req, res, _next) => {
    if (err instanceof AppError) {
      res.status(err.status).json({ error: err.message });
      return;
    }
    // Errors from Express itself, e.g. body-parser's 400 (bad JSON) and 413 (too large).
    const status = err.status ?? 500;
    if (status >= 500) console.error(err);
    const generic = status === 413 ? 'That image is too large.' : status < 500 ? 'Bad request.' : 'Server error.';
    // A throw from a route (not an AppError) still ends as JSON, never an HTML error page.
    res.status(status).json({ error: showDetail && status >= 500 && err.message ? `Server error: ${err.message}` : generic });
  };
}
