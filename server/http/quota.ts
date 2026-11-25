import type { Request } from 'express';
import { AppError } from '../lib/errors';
import { RateLimiter } from '../lib/rateLimiter';

/** A per-visitor allowance, e.g. images per hour. `take` throws a 429 with `message` when it is used up. */
export interface Quota {
  take(req: Request, count?: number): void;
}

export function createQuota(max: number, windowMs: number, message: string): Quota {
  const limiter = new RateLimiter(max, windowMs);
  return {
    take(req, count = 1) {
      if (!limiter.take(req.ip ?? 'unknown', count)) throw new AppError(429, message);
    },
  };
}
