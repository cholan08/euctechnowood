import { useLayoutEffect, useRef, useState } from 'react';

export interface Size {
  width: number;
  height: number;
}

/**
 * The largest box with the given aspect ratio that fits inside the element.
 * Used so the before/after image fills the screen without any page scroll.
 */
export function useFitSize<T extends HTMLElement>(ratio: number) {
  const ref = useRef<T>(null);
  const [size, setSize] = useState<Size | null>(null);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new ResizeObserver(([entry]) => {
      const { width: cw, height: ch } = entry.contentRect;
      if (!cw || !ch) return;
      let width = cw;
      let height = cw / ratio;
      if (height > ch) {
        height = ch;
        width = ch * ratio;
      }
      setSize({ width: Math.floor(width), height: Math.floor(height) });
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, [ratio]);

  return [ref, size] as const;
}
