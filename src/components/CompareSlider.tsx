import { useState } from 'react';

interface Props {
  before: string;
  after: string;
  ratio: number;
  label: string;
}

/** Drag across the image to compare the original photo with the new design. */
export function CompareSlider({ before, after, ratio, label }: Props) {
  const [pos, setPos] = useState(50);

  return (
    <div className="compare" style={{ aspectRatio: ratio }}>
      <img src={after} alt={`${label} design`} />
      <img src={before} alt="" className="compare-before" style={{ clipPath: `inset(0 ${100 - pos}% 0 0)` }} />
      <div className="compare-line" style={{ left: `${pos}%` }} aria-hidden="true" />
      <span className="tag tag-left">Before</span>
      <span className="tag tag-right">After</span>
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
