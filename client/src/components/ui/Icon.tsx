// A small set of line icons (24px grid, stroke = currentColor), so the app needs no icon library.
const PATHS = {
  upload: 'M12 15V3m0 0L7 8m5-5 5 5M4 15v4a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-4',
  photo: 'M4 5h16a1 1 0 0 1 1 1v12a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1Zm-1 11 5-5 4 4 3-3 6 6M15.5 9.5h.01',
  cube: 'M12 2.5 20.5 7v10L12 21.5 3.5 17V7L12 2.5Zm0 9.5 8.5-5M12 12 3.5 7M12 12v9.5',
  download: 'M12 3v12m0 0-5-5m5 5 5-5M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2',
  wand: 'm15 4 1 2 2 1-2 1-1 2-1-2-2-1 2-1 1-2ZM4 20 14 10M19 13l.5 1 1 .5-1 .5-.5 1-.5-1-1-.5 1-.5.5-1Z',
  plus: 'M12 5v14M5 12h14',
  check: 'm5 12.5 4.5 4.5L19 7.5',
  alert: 'M12 8v5m0 3.5h.01M10.3 3.9 2.4 17.6A2 2 0 0 0 4.1 20.6h15.8a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z',
  sparkle: 'M12 3v4M12 17v4M3 12h4M17 12h4M6.3 6.3l2.4 2.4M15.3 15.3l2.4 2.4M6.3 17.7l2.4-2.4M15.3 8.7l2.4-2.4',
  refresh: 'M20 11a8 8 0 1 0-2.3 5.7M20 4v7h-7',
  lock: 'M7.5 11V8a4.5 4.5 0 0 1 9 0v3M5.5 11h13v10h-13z',
  chevron: 'm6 9 6 6 6-6',
  copy: 'M9 9h11v11H9zM5 15H4V4h11v1',
  x: 'M6 6l12 12M18 6 6 18',
  pin: 'M12 21s-6.5-5.6-6.5-11a6.5 6.5 0 0 1 13 0c0 5.4-6.5 11-6.5 11Zm0-8.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5Z',
} as const;

export type IconName = keyof typeof PATHS;

export function Icon({ name, size = 18 }: { name: IconName; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d={PATHS[name]} />
    </svg>
  );
}

/**
 * The Room Studio mark: a room outline whose right half is solid,
 * the before → after idea in one shape. Same drawing as public/favicon.svg.
 */
export function Mark({ size = 28 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden="true">
      <rect width="32" height="32" rx="8" style={{ fill: 'var(--accent)' }} />
      <path d="M16 7.5 24 14v10.5h-8Z" style={{ fill: 'var(--on-accent)' }} />
      <path d="M8 14 16 7.5 24 14v10.5H8Z" fill="none" style={{ stroke: 'var(--on-accent)' }} strokeWidth="2.2" strokeLinejoin="round" />
    </svg>
  );
}
