import type { Variation } from '../../shared/types';
import { CompareSlider } from './CompareSlider';

interface Props {
  before: string;
  ratio: number;
  variations: Variation[];
  onContinue: (variation: Variation) => void;
}

function fileName(v: Variation): string {
  const ext = v.image?.startsWith('data:image/jpeg') ? 'jpg' : 'png';
  return `room-design-${(v.styleId ?? 'custom').replace(/[^a-z0-9-]/gi, '')}.${ext}`;
}

export function Results({ before, ratio, variations, onContinue }: Props) {
  return (
    <div className="results">
      {variations.map((v, i) => (
        <article key={`${v.styleId}-${i}`} className="result">
          <header>
            <h3>{v.label}</h3>
            <span className="muted">{(v.ms / 1000).toFixed(1)} s</span>
          </header>

          {v.image ? (
            <CompareSlider before={before} after={v.image} ratio={ratio} label={v.label} />
          ) : (
            <div className="result-error" style={{ aspectRatio: ratio }}>
              {v.error ?? 'No image was returned.'}
            </div>
          )}

          {v.image && (
            <div className="row">
              <a className="btn" href={v.image} download={fileName(v)}>
                Download
              </a>
              <button type="button" className="btn" onClick={() => onContinue(v)}>
                Edit this design further
              </button>
            </div>
          )}

          <details>
            <summary>Prompt sent to the AI</summary>
            <pre>{v.prompt}</pre>
          </details>
        </article>
      ))}
    </div>
  );
}
