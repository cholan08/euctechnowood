import { useState } from 'react';
import type { Size } from '../../../lib/useFitSize';

interface Props {
  before: string;
  after: string;
  ratio: number;
  label: string;
  beforeLabel?: string;
  afterLabel?: string;
  /** Exact size in pixels; without it the slider is full width at the image's aspect ratio. */
  size?: Size | null;
}

/** Drag across the image to compare the original with the new design. */
export function CompareSlider({ before, after, ratio, label, beforeLabel = 'Before', afterLabel = 'After', size }: Props) {
  const [pos, setPos] = useState(50);

  return (
    <div className="compare" style={size ? { width: size.width, height: size.height } : { aspectRatio: ratio }}>
      <img src={after} alt={`${label} design`} draggable={false} />
      <img src={before} alt="" draggable={false} style={{ clipPath: `inset(0 ${100 - pos}% 0 0)` }} />
      <div className="compare-line" style={{ left: `${pos}%` }} aria-hidden="true">
        <span className="compare-handle">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="m9 7-5 5 5 5M15 7l5 5-5 5" />
          </svg>
        </span>
      </div>
      <span className="tag tag-left">{beforeLabel}</span>
      <span className="tag tag-right">{afterLabel}</span>
      <input
        type="range"
        min={0}
        max={100}
        value={pos}
        onChange={(e) => setPos(Number(e.target.value))}
        aria-label={`Compare before and after: ${label}`}
      />
    </div>
  );
}
