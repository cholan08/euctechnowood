import type { CSSProperties } from 'react';
import type { Variation } from '../../../shared/types';
import { useFitSize } from '../../lib/useFitSize';
import { CompareSlider } from './CompareSlider';

const STAGES = [
  'Reading your room…',
  'Keeping your walls, windows and doors…',
  'Applying your style and finishes…',
  'Adding light and finishing touches…',
];

interface Props {
  before: string;
  ratio: number;
  busy: boolean;
  elapsed: number;
  /** How many designs are being made (for the loading placeholders). */
  pending: number;
  generateLabel: string;
  variations: Variation[] | null;
  selected: number;
  onSelect: (index: number) => void;
  /** Show the prompt sent to the AI (open the page with ?debug). */
  debug: boolean;
  onRefine: (variation: Variation) => void;
  /** Ids of designs already downloaded (images are not stored anywhere else). */
  downloaded: ReadonlySet<string>;
  onDownload: (variation: Variation) => void;
  onDownloadAll: () => void;
}

/** The big image area: the uploaded image, the loading state, or the designs to compare. */
export function Viewer(props: Props) {
  const { before, ratio, busy, elapsed, pending, generateLabel, variations, selected, onSelect, debug, onRefine } = props;
  const { downloaded, onDownload, onDownloadAll } = props;
  const ready = variations?.filter((v) => v.image) ?? [];
  const notSaved = ready.filter((v) => !downloaded.has(v.id)).length;
  const [canvasRef, size] = useFitSize<HTMLDivElement>(ratio);
  const current = variations?.[selected];
  const stage = STAGES[Math.min(STAGES.length - 1, Math.floor(elapsed / 7))];

  return (
    <section className="viewer" aria-live="polite" aria-busy={busy}>
      {/* --ratio lets phones size this box to the image's shape (see studio.css). */}
      <div className="canvas" ref={canvasRef} style={{ '--ratio': ratio } as CSSProperties}>
        {size &&
          (busy ? (
            <div className="canvas-loading" style={size}>
              <img src={before} alt="" />
              <div className="loading-banner">
                <span className="spinner" />
                <div>
                  <strong>{stage}</strong>
                  <span>
                    Creating {pending} design{pending > 1 ? 's' : ''} · usually 15–40 seconds · {elapsed}s
                  </span>
                </div>
              </div>
            </div>
          ) : current?.image ? (
            <CompareSlider key={current.id} before={before} after={current.image} ratio={ratio} label={current.label} size={size} />
          ) : current ? (
            <div className="result-error" style={size}>
              <strong>{current.label}</strong>
              <span>{current.error ?? 'No image was returned.'}</span>
            </div>
          ) : (
            <img className="canvas-image" src={before} alt="Your uploaded image" style={size} />
          ))}
      </div>

      <div className="viewer-foot">
        {busy ? (
          <div className="variant-strip">
            {Array.from({ length: pending }, (_, i) => (
              <span key={i} className="variant skeleton" />
            ))}
          </div>
        ) : variations ? (
          <div className="variant-strip" role="tablist" aria-label="Your designs">
            {variations.map((v, i) => (
              <button
                key={v.id ?? i}
                type="button"
                role="tab"
                aria-selected={i === selected}
                className={`variant${v.image ? '' : ' failed'}`}
                onClick={() => onSelect(i)}
              >
                {v.image ? <img src={v.image} alt="" /> : <span className="variant-x">!</span>}
                {downloaded.has(v.id) && (
                  <span className="variant-saved" title="Downloaded">
                    ✓ Saved
                  </span>
                )}
                <span className="variant-label">{v.label}</span>
              </button>
            ))}
          </div>
        ) : (
          <p className="viewer-hint">
            <strong>Looks good.</strong> Pick your options on the left, then press <em>{generateLabel}</em>.
          </p>
        )}

        {!busy && current?.image && (
          <div className="viewer-actions">
            <button type="button" className="btn btn-sm" onClick={() => onRefine(current)}>
              Refine this design
            </button>
            {ready.length > 1 && (
              <button type="button" className="btn btn-sm download-all" onClick={onDownloadAll}>
                Download all ({ready.length})
              </button>
            )}
            <button type="button" className="btn btn-gold download-btn" onClick={() => onDownload(current)}>
              {downloaded.has(current.id) ? 'Download again' : 'Download design'}
            </button>
          </div>
        )}
      </div>

      {!busy && notSaved > 0 && (
        <p className="save-reminder" role="status">
          Designs are not saved anywhere. Download the ones you want to keep ({notSaved} not downloaded yet).
        </p>
      )}

      {debug && current && (
        <details className="debug">
          <summary>
            Prompt sent to the AI · {(current.ms / 1000).toFixed(1)} s
          </summary>
          <pre>{current.prompt}</pre>
        </details>
      )}
    </section>
  );
}
