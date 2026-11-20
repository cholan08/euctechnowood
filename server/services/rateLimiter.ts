/**
 * A sliding-window limiter, in memory and per process (it resets on restart).
 * Used for generated images (each one costs money), lead submissions and admin
 * logins. Replace with a shared store (Redis) if the app runs on several servers.
 */
export class RateLimiter {
  private readonly hits = new Map<string, number[]>();

  constructor(
    private readonly max: number,
    private readonly windowMs: number,
  ) {}

  /** Reserves `count` units for `key`. Returns false (and reserves nothing) if over the limit. */
  take(key: string, count = 1): boolean {
    const now = Date.now();
    const recent = (this.hits.get(key) ?? []).filter((t) => now - t < this.windowMs);
    if (recent.length + count > this.max) {
      this.hits.set(key, recent);
      return false;
    }
    for (let i = 0; i < count; i++) recent.push(now);
    this.hits.set(key, recent);
    return true;
  }
}
