import type { CSSProperties, MouseEvent } from 'react';
import type { Point } from '../../../../shared/catalog';
import type { Variation } from '../../../../shared/types';
import { useFitSize } from '../../lib/useFitSize';
import { Icon } from '../ui/Icon';
import { CompareSlider } from './CompareSlider';

const STAGES = [
  'Reading the room',
  'Locking the layout, cabinets and openings',
  'Applying materials and finishes',
  'Matching light and reflections',
];

interface Props {
  before: string;
  ratio: number;
  busy: boolean;
  elapsed: number;
  /** How many designs are being made (for the loading placeholders). */
  pending: number;
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
  /** Name of the part whose position is being picked, or null. */
  picking: string | null;
  /** Parts of the option being edited that only change at one place. */
  markers: (Point & { id: string; label: string })[];
  onPick: (area: Point) => void;
  onCancelPick: () => void;
}

const num = (i: number) => String(i + 1).padStart(2, '0');

/** The big image area: the uploaded image, the loading state, or the designs to compare. */
export function Viewer(props: Props) {
  const { before, ratio, busy, elapsed, pending, variations, selected, onSelect, debug, onRefine } = props;
  const { downloaded, onDownload, onDownloadAll, picking, markers, onPick, onCancelPick } = props;
  const ready = variations?.filter((v) => v.image) ?? [];
  const notSaved = ready.filter((v) => !downloaded.has(v.id)).length;
  const [canvasRef, size] = useFitSize<HTMLDivElement>(ratio);
  const current = variations?.[selected];
  const stageIndex = Math.min(STAGES.length - 1, Math.floor(elapsed / 7));

  function pick(e: MouseEvent<HTMLButtonElement>) {
    // A keyboard press has no pointer position: use the centre.
    if (e.detail === 0) return onPick({ x: 0.5, y: 0.5 });
    const box = e.currentTarget.getBoundingClientRect();
    const clamp = (n: number) => Math.min(1, Math.max(0, Math.round(n * 1000) / 1000));
    onPick({ x: clamp((e.clientX - box.left) / box.width), y: clamp((e.clientY - box.top) / box.height) });
  }

  const pins = markers.map((m) => (
    // Near the right edge the label goes on the left of the dot, so it stays on the image.
    <span key={m.id} className={`marker${m.x > 0.75 ? ' flip' : ''}`} style={{ left: `${m.x * 100}%`, top: `${m.y * 100}%` }} aria-hidden="true">
      <span>{m.label}</span>
    </span>
  ));

  return (
    <section className="stage" aria-live="polite" aria-busy={busy}>
      {/* --ratio lets phones size this box to the image's shape (see studio.css). */}
      <div className="canvas" ref={canvasRef} style={{ '--ratio': ratio } as CSSProperties}>
        {size &&
          (busy ? (
            <div className="canvas-loading" style={size}>
              <img src={before} alt="" />
              <span className="scan" aria-hidden="true" />
              <div className="loading-card">
                <span className="spinner" />
                <div>
                  <strong>{STAGES[stageIndex]}…</strong>
                  <span>
                    {pending} design{pending > 1 ? 's' : ''} · usually 15–40 s · <b>{elapsed}s</b>
                  </span>
                </div>
              </div>
            </div>
          ) : picking ? (
            <div className="canvas-frame picking" style={size}>
              <button type="button" className="pick-surface" onClick={pick} aria-label={`Pick where the ${picking} is`}>
                <img src={before} alt="" />
              </button>
              {pins}
              <div className="pick-banner" role="status">
                <Icon name="pin" size={14} />
                <span>
                  Click on the <b>{picking.toLowerCase()}</b> to change only that one
                </span>
                <button type="button" className="link" onClick={onCancelPick}>
                  Cancel <kbd>Esc</kbd>
                </button>
              </div>
            </div>
          ) : current?.image ? (
            <CompareSlider key={current.id} before={before} after={current.image} ratio={ratio} label={current.label} afterLabel={current.label} size={size} />
          ) : current ? (
            <div className="result-error" style={size}>
              <Icon name="alert" size={22} />
              <strong>{current.label} didn't work</strong>
              <span>{current.error ?? 'No image was returned.'}</span>
            </div>
          ) : (
            <div className="canvas-frame" style={size}>
              <img src={before} alt="Your uploaded image" />
              {pins}
              <span className="tag tag-left">Original</span>
            </div>
          ))}
      </div>

      {!busy && current && current.specs.length > 0 && (
        <ul className="spec-bar" aria-label={`${current.label} spec`}>
          <li className="spec-name">{current.label}</li>
          {current.specs.map((s) => (
            <li key={s.label} title={`${s.label}: ${s.value}`}>
              {s.hex && <span className="spec-dot" style={{ background: s.hex }} aria-hidden="true" />}
              <span className="spec-label">{s.label}</span> {s.value}
            </li>
          ))}
        </ul>
      )}

      <div className="stage-foot">
        {busy ? (
          <div className="filmstrip">
            {Array.from({ length: pending }, (_, i) => (
              <span key={i} className="frame skeleton" />
            ))}
          </div>
        ) : variations ? (
          <div className="filmstrip" role="tablist" aria-label="Your designs">
            {variations.map((v, i) => (
              <button
                key={v.id ?? i}
                type="button"
                role="tab"
                aria-selected={i === selected}
                className={`frame${v.image ? '' : ' failed'}`}
                onClick={() => onSelect(i)}
                title={v.label}
              >
                {v.image ? <img src={v.image} alt="" /> : <Icon name="alert" size={18} />}
                <span className="frame-num">{num(i)}</span>
                {downloaded.has(v.id) && (
                  <span className="frame-saved" title="Downloaded">
                    <Icon name="check" size={12} />
                  </span>
                )}
                <span className="frame-label">{v.label}</span>
              </button>
            ))}
          </div>
        ) : (
          <p className="stage-hint">
            Set the new materials on the left, then press <b>Generate</b> <kbd>Ctrl</kbd> <kbd>↵</kbd>
          </p>
        )}

        {!busy && current?.image && (
          <div className="stage-actions">
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => onRefine(current)} title="Use this design as the new starting image">
              <Icon name="wand" size={16} /> Refine
            </button>
            {ready.length > 1 && (
              <button type="button" className="btn btn-sm" onClick={onDownloadAll}>
                Download all ({ready.length})
              </button>
            )}
            <button type="button" className="btn btn-accent btn-sm" onClick={() => onDownload(current)}>
              <Icon name="download" size={16} />
              {downloaded.has(current.id) ? 'Download again' : 'Download'}
            </button>
          </div>
        )}
      </div>

      {!busy && notSaved > 0 && (
        <p className="save-note" role="status">
          <span className="dot" aria-hidden="true" />
          Not stored anywhere: {notSaved} design{notSaved > 1 ? 's' : ''} not downloaded yet.{' '}
          <span className="save-keys">
            <kbd>←</kbd> <kbd>→</kbd> to switch
          </span>
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
