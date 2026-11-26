import { describe, expect, it } from 'vitest';
import { initials, progressOf, roomsLine } from './progress';

const NOW = Date.parse('2026-11-26T12:00:00Z');
const daysAgo = (d: number) => new Date(NOW - d * 86_400_000).toISOString();
const base = { status: 'active' as const, roomCount: 0, designedRoomCount: 0, updatedAt: daysAgo(0) };

describe('project progress', () => {
  it('walks an in-design project from photos to ready', () => {
    expect(progressOf(base, NOW)).toMatchObject({ done: 0, next: 'Add room photos', tone: 'todo' });
    expect(progressOf({ ...base, roomCount: 3 }, NOW)).toMatchObject({ done: 1, next: 'Start designing' });
    expect(progressOf({ ...base, roomCount: 3, designedRoomCount: 2 }, NOW)).toMatchObject({ done: 1, next: '2 of 3 rooms designed' });
    expect(progressOf({ ...base, roomCount: 3, designedRoomCount: 3 }, NOW)).toMatchObject({ done: 2, next: 'Ready to present' });
  });

  it('waits on the client after presenting, then asks for a follow-up', () => {
    const presented = { ...base, status: 'presented' as const, roomCount: 2, designedRoomCount: 2 };
    expect(progressOf({ ...presented, updatedAt: daysAgo(6) }, NOW)).toMatchObject({ done: 3, tone: 'wait', next: 'Waiting on client' });
    expect(progressOf({ ...presented, updatedAt: daysAgo(9) }, NOW)).toMatchObject({ done: 3, tone: 'alert', next: 'Follow up · quiet 9 days' });
  });

  it('marks approved and archived projects as needing nothing', () => {
    expect(progressOf({ ...base, status: 'approved' }, NOW)).toMatchObject({ done: 4, tone: 'done' });
    expect(progressOf({ ...base, status: 'archived', roomCount: 1 }, NOW)).toMatchObject({ done: 1, tone: 'muted', next: 'Archived' });
  });
});

describe('labels', () => {
  it('shortens room lists', () => {
    expect(roomsLine([])).toBe('No rooms yet');
    expect(roomsLine(['Kitchen'])).toBe('Kitchen');
    expect(roomsLine(['Kitchen', 'Living', 'Bedroom', 'Bath'])).toBe('Kitchen, Living +2');
  });

  it('makes initials', () => {
    expect(initials('Priya Raman')).toBe('PR');
    expect(initials('Anand K Subramanian')).toBe('AS');
    expect(initials('studio')).toBe('ST');
    expect(initials('  ')).toBe('?');
  });
});
