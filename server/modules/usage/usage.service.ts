import type { UsageSummary } from '@shared/workspace';
import { now, type Db } from '../../db/database';
import { AppError } from '../../lib/errors';
import type { SessionUser } from '../../http/auth';

// Every AI call is logged (who, what, how many images, how long, ok or failed),
// and each person has a daily image limit so a stuck loop or a busy day cannot run
// up an unexpected bill. "Today" is the day in India, where EUC works.

const IST_OFFSET_MS = 330 * 60 * 1000;

/** Start of the current day in India, as an ISO time in UTC. */
export function startOfDayIst(at = Date.now()): string {
  const local = new Date(at + IST_OFFSET_MS);
  local.setUTCHours(0, 0, 0, 0);
  return new Date(local.getTime() - IST_OFFSET_MS).toISOString();
}

export type UsageAction = 'edit' | 'remove' | 'redesign' | 'generate' | 'final' | 'assist' | 'recommend';

export interface UsageEntry {
  userId: string | null;
  action: UsageAction;
  images: number;
  provider: string;
  ok: boolean;
  ms: number;
  error?: string;
}

export interface UsageService {
  log(entry: UsageEntry): void;
  /** Images made today (successful calls only: failed ones are not charged). */
  usedToday(userId: string): number;
  limitFor(user: Pick<SessionUser, 'dailyLimit'>): number;
  /** Throws a 429 if `count` more images would pass the person's limit today. */
  reserve(user: SessionUser, count: number): void;
  summary(): UsageSummary;
  /** Runs an AI call and logs it, whatever happens. */
  track<T>(entry: Omit<UsageEntry, 'ok' | 'ms' | 'error'>, work: () => Promise<T>, imagesOk?: (result: T) => number): Promise<T>;
}

export function createUsageService(db: Db, { defaultLimit }: { defaultLimit: number }): UsageService {
  const service: UsageService = {
    log(e) {
      db.run(
        'INSERT INTO usage_log (user_id, created_at, action, images, provider, status, ms, error) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
        e.userId,
        now(),
        e.action,
        e.images,
        e.provider,
        e.ok ? 'ok' : 'failed',
        Math.round(e.ms),
        e.error?.slice(0, 500) ?? null,
      );
    },

    usedToday(userId) {
      const row = db.get<{ n: number | null }>("SELECT SUM(images) AS n FROM usage_log WHERE user_id = ? AND created_at >= ? AND status = 'ok'", userId, startOfDayIst());
      return row?.n ?? 0;
    },

    limitFor: (user) => user.dailyLimit ?? defaultLimit,

    reserve(user, count) {
      if (count <= 0) return;
      const left = service.limitFor(user) - service.usedToday(user.id);
      if (count > left) {
        throw new AppError(
          429,
          left > 0 ? `Only ${left} image${left === 1 ? '' : 's'} left for you today. Make fewer at once, or ask an admin to raise your limit.` : 'You have used all your images for today. Ask an admin to raise your limit.',
        );
      }
    },

    async track(entry, work, imagesOk) {
      const started = Date.now();
      try {
        const result = await work();
        service.log({ ...entry, images: imagesOk ? imagesOk(result) : entry.images, ok: true, ms: Date.now() - started });
        return result;
      } catch (err) {
        service.log({ ...entry, images: 0, ok: false, ms: Date.now() - started, error: err instanceof Error ? err.message : String(err) });
        throw err;
      }
    },

    summary() {
      const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
      // Days are counted in India time: shift by +05:30 before taking the date.
      const days = db.all<UsageSummary['days'][number]>(
        `SELECT substr(datetime(created_at, '+330 minutes'), 1, 10) AS day,
                SUM(images) AS images, COUNT(*) AS calls, SUM(status = 'failed') AS failed
           FROM usage_log WHERE created_at >= ? GROUP BY day ORDER BY day DESC`,
        since,
      );
      const people = db.all<UsageSummary['people'][number]>(
        `SELECT l.user_id AS userId, COALESCE(u.name, 'Deleted account') AS name,
                SUM(l.images) AS images, COUNT(*) AS calls, SUM(l.status = 'failed') AS failed
           FROM usage_log l LEFT JOIN users u ON u.id = l.user_id
          WHERE l.created_at >= ? GROUP BY l.user_id ORDER BY images DESC`,
        since,
      );
      const t = db.get<{ images: number | null; calls: number; failed: number | null; avgMs: number | null }>(
        `SELECT SUM(images) AS images, COUNT(*) AS calls, SUM(status = 'failed') AS failed, AVG(ms) AS avgMs FROM usage_log WHERE created_at >= ?`,
        since,
      )!;
      return { days, people, totals: { images: t.images ?? 0, calls: t.calls, failed: t.failed ?? 0, avgMs: Math.round(t.avgMs ?? 0) } };
    },
  };
  return service;
}
