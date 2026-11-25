import { afterEach, describe, expect, it, vi } from 'vitest';
import { RateLimiter } from './rateLimiter';

describe('RateLimiter', () => {
  afterEach(() => vi.useRealTimers());

  it('allows up to the limit per key, then refuses without reserving', () => {
    const limiter = new RateLimiter(3, 1000);
    expect(limiter.take('a', 2)).toBe(true);
    expect(limiter.take('a', 2)).toBe(false);
    expect(limiter.take('a', 1)).toBe(true);
    expect(limiter.take('a')).toBe(false);
    expect(limiter.take('b', 3)).toBe(true);
  });

  it('frees units once the window has passed', () => {
    vi.useFakeTimers();
    const limiter = new RateLimiter(1, 1000);
    expect(limiter.take('a')).toBe(true);
    vi.advanceTimersByTime(999);
    expect(limiter.take('a')).toBe(false);
    vi.advanceTimersByTime(2);
    expect(limiter.take('a')).toBe(true);
  });
});
