/**
 * Every generated image costs money, so a public upload page needs a limit.
 * This in-memory sliding window counts images per key (visitor IP for now).
 * It resets when the server restarts and is per-process; replace it with
 * per-account quotas in a database once there are logins.
 */
export class ImageQuota {
  private readonly hits = new Map<string, number[]>();

  constructor(
    private readonly max: number,
    private readonly windowMs: number,
  ) {}

  /** Reserves `count` images for `key`. Returns false (and reserves nothing) if over the limit. */
  take(key: string, count: number): boolean {
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
