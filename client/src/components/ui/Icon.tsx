// A small set of line icons (24px grid, stroke = currentColor), so the app needs no icon library.
const PATHS = {
  upload: 'M12 15V3m0 0L7 8m5-5 5 5M4 15v4a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-4',
  photo: 'M4 5h16a1 1 0 0 1 1 1v12a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1Zm-1 11 5-5 4 4 3-3 6 6M15.5 9.5h.01',
  download: 'M12 3v12m0 0-5-5m5 5 5-5M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2',
  plus: 'M12 5v14M5 12h14',
  check: 'm5 12.5 4.5 4.5L19 7.5',
  alert: 'M12 8v5m0 3.5h.01M10.3 3.9 2.4 17.6A2 2 0 0 0 4.1 20.6h15.8a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z',
  sparkle: 'M12 3v4M12 17v4M3 12h4M17 12h4M6.3 6.3l2.4 2.4M15.3 15.3l2.4 2.4M6.3 17.7l2.4-2.4M15.3 8.7l2.4-2.4',
  refresh: 'M20 11a8 8 0 1 0-2.3 5.7M20 4v7h-7',
  lock: 'M7.5 11V8a4.5 4.5 0 0 1 9 0v3M5.5 11h13v10h-13z',
  x: 'M6 6l12 12M18 6 6 18',
  wand: 'm15 4 1 2 2 1-2 1-1 2-1-2-2-1 2-1 1-2ZM4 20 14 10M19 13l.5 1 1 .5-1 .5-.5 1-.5-1-1-.5 1-.5.5-1Z',
  chevron: 'm6 9 6 6 6-6',
  arrow: 'M5 12h14m0 0-5-5m5 5-5 5',
  copy: 'M9 9h11v11H9zM5 15H4V4h11v1',
  pin: 'M12 21s-6.5-5.6-6.5-11a6.5 6.5 0 0 1 13 0c0 5.4-6.5 11-6.5 11Zm0-8.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5Z',
  sliders: 'M4 7h10M18 7h2M4 17h4M12 17h8M14 5v4M8 15v4',
  // Final 2K
  hd: 'M3 6h18v12H3zM7 9.5v5M7 12h3M10 9.5v5M14 9.5v5h1.5a2.5 2.5 0 0 0 0-5H14Z',
  // Marking tools
  brush: 'M20 4 11.5 12.5M11.5 12.5c-1-1-3.2-.9-4.5.4-1.6 1.6-1.1 3.9-3 5.6 2.6.8 5.6.4 7.1-1.1 1.3-1.3 1.4-3.9.4-4.9Z',
  shape: 'M6 6.5 17.5 4 20 15l-9 5-6.5-6.5L6 6.5Z',
  eraser: 'M9 20h11M4.7 14.3l9.6-9.6a1.5 1.5 0 0 1 2.1 0l3.9 3.9a1.5 1.5 0 0 1 0 2.1L12 19H9.4l-4.7-4.7Zm4.6-4.6 6 6',
  undo: 'M9 14 4 9l5-5M4 9h10.5a5.5 5.5 0 0 1 0 11H11',
  trash: 'M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3',
  compare: 'M4 5h16v14H4zM12 3v18',
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
