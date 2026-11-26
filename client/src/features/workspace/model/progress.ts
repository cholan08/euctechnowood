import { FOLLOW_UP_DAYS, type ProjectSummary } from '@shared/workspace';

// Where a project stands and what to do next, read from what is already stored:
// room photos, kept designs, status and the last activity.

/** The four steps every project walks through, in order. */
export const STEPS = ['Room photos', 'Designs', 'Presented', 'Approved'] as const;

export interface Progress {
  /** How many of STEPS are done (0-4). */
  done: number;
  /** The next thing to do, or the state when nothing is due from the studio. */
  next: string;
  /** todo: the studio's move. wait: the client's move. alert: overdue follow-up. done / muted: nothing to do. */
  tone: 'todo' | 'wait' | 'alert' | 'done' | 'muted';
}

type Fields = Pick<ProjectSummary, 'status' | 'roomCount' | 'designedRoomCount' | 'updatedAt'>;

export const daysSince = (iso: string, now = Date.now()) => Math.max(0, Math.floor((now - Date.parse(iso)) / 86_400_000));

export function progressOf(p: Fields, now = Date.now()): Progress {
  const work = p.roomCount === 0 ? 0 : p.designedRoomCount < p.roomCount ? 1 : 2;
  switch (p.status) {
    case 'archived':
      return { done: work, next: 'Archived', tone: 'muted' };
    case 'approved':
      return { done: 4, next: 'Approved by client', tone: 'done' };
    case 'presented': {
      const quiet = daysSince(p.updatedAt, now);
      return quiet >= FOLLOW_UP_DAYS
        ? { done: 3, next: `Follow up · quiet ${quiet} days`, tone: 'alert' }
        : { done: 3, next: 'Waiting on client', tone: 'wait' };
    }
    default:
      if (p.roomCount === 0) return { done: 0, next: 'Add room photos', tone: 'todo' };
      if (p.designedRoomCount === 0) return { done: 1, next: 'Start designing', tone: 'todo' };
      if (p.designedRoomCount < p.roomCount) return { done: 1, next: `${p.designedRoomCount} of ${p.roomCount} rooms designed`, tone: 'todo' };
      return { done: 2, next: 'Ready to present', tone: 'todo' };
  }
}

/** "Kitchen, Master bedroom +2" */
export function roomsLine(names: string[], show = 2): string {
  if (!names.length) return 'No rooms yet';
  const rest = names.length - show;
  return names.slice(0, show).join(', ') + (rest > 0 ? ` +${rest}` : '');
}

/** "Priya Raman" → "PR", "studio" → "ST" */
export function initials(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (!words.length) return '?';
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return (words[0][0] + words[words.length - 1][0]).toUpperCase();
}
