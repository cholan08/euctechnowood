import { useEffect, useRef, type CSSProperties, type MouseEvent } from 'react';
import type { Point } from '../../../../shared/catalog';
import type { Final, Mode, Step } from '../../lib/change';
import type { MaskOp } from '../../lib/mask';
import { useFitSize } from '../../lib/useFitSize';
import { Icon, type IconName } from '../ui/Icon';
import { CompareSlider } from './CompareSlider';
import { MaskEditor, type Tool } from './MaskEditor';

export type View = 'edit' | 'compare' | 'final';

/** What the AI is working on, for the loading card. */
export interface Busy {
  kind: 'mark' | 'design' | 'final';
  /** "Base cabinets"; unused for the others. */
  label: string;
  /** Overrides the loading card's heading, e.g. "Placing the item…". */
  title?: string;
  /** How many images are being made. */
  count: number;
  /** The image being worked on, shown blurred underneath. */
  base: string;
}

const TOOLS: { id: Tool; label: string; icon: IconName; title: string }[] = [
  { id: 'brush', label: 'Brush', icon: 'brush', title: 'Paint over the part' },
  { id: 'shape', label: 'Corners', icon: 'shape', title: 'Click the corners of a straight-edged part' },
  { id: 'eraser', label: 'Eraser', icon: 'eraser', title: 'Remove part of the mark' },
];

const DESIGN_STAGES = ['Reading the room', 'Locking the layout, cabinets and openings', 'Applying materials and finishes', 'Matching light and reflections'];

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`;

interface Props {
  mode: Mode;
  original: string;
  /** The latest image: the photo, or the result of the last change. */
  current: string;
  width: number;
  height: number;
  view: View;
  onView: (view: View) => void;
  busy: Busy | null;
  elapsed: number;

  // Mark & edit
  ops: MaskOp[];
  onOps: (ops: MaskOp[]) => void;
  tool: Tool;
  onTool: (tool: Tool) => void;
  /** Brush diameter as a % of the photo's longer side. */
  brushPct: number;
  onBrushPct: (pct: number) => void;
  /** The part being marked, e.g. "base cabinets". */
  part: string | null;

  // Standard: "only this one" positions
  picking: string | null;
  markers: (Point & { id: string; label: string })[];
  onPick: (area: Point) => void;
  onCancelPick: () => void;

  steps: Step[];
  /** Standard: use another option (A–D) of the last design. */
  onChoose: (index: number) => void;
  onUndo: () => void;
  onRetry: () => void;
  onDownload: () => void;
  /** The image on screen has been downloaded. */
  saved: boolean;
  /** Nothing of the latest result (edited or final) has been downloaded. */
  unsaved: boolean;

  /** The final 2K image, when it matches the latest change. */
  final: Final | null;
  onFinal: () => void;
  onDownloadFinal: () => void;
  /** Show the prompt sent to the AI (open the page with ?debug). */
  debug: boolean;
}

/** The big image area: mark the part, watch the AI work, compare, and make the final image. */
export function Viewer(props: Props) {
  const { mode, original, current, width, height, view, onView, busy, elapsed } = props;
  const { ops, onOps, tool, onTool, brushPct, onBrushPct, part, picking, markers, onPick, onCancelPick } = props;
  const { steps, onChoose, onUndo, onRetry, onDownload, saved, unsaved, final, onFinal, onDownloadFinal, debug } = props;
  const ratio = width / height;
  const [canvasRef, size] = useFitSize<HTMLDivElement>(ratio);
  const last = steps.at(-1);
  // Views fall back to editing when there is nothing to show in them.
  const shown: View = view === 'final' && final ? 'final' : view === 'compare' && last ? 'compare' : 'edit';
  const marking = mode === 'mark' && shown === 'edit' && !busy;
  const brush = (brushPct / 100) * Math.max(width, height);
  const after = `After ${plural(steps.length, 'change')}`;
  const options = last?.kind === 'design' && last.variations.length > 1 ? last : null;

  // The newest change is the one that matters: keep the end of the list in view.
  const listRef = useRef<HTMLOListElement>(null);
  useEffect(() => {
    const list = listRef.current;
    if (list) list.scrollLeft = list.scrollWidth;
  }, [steps.length]);

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

  const views: { id: View; label: string; icon: IconName; show: boolean }[] = [
    { id: 'edit', label: mode === 'mark' ? 'Mark' : 'Image', icon: mode === 'mark' ? 'brush' : 'photo', show: true },
    { id: 'compare', label: 'Before / after', icon: 'compare', show: Boolean(last) },
    { id: 'final', label: 'Final 2K', icon: 'hd', show: Boolean(final) },
  ];

  let canvas = null;
  if (!size) {
    canvas = null;
  } else if (busy) {
    const stage = DESIGN_STAGES[Math.min(DESIGN_STAGES.length - 1, Math.floor(elapsed / 7))];
    const [title, detail] =
      busy.kind === 'mark'
        ? [busy.title ?? `Changing the ${busy.label.toLowerCase()}…`, 'Only the marked area will be replaced · usually 15–40 s']
        : busy.kind === 'design'
          ? [`${stage}…`, `${plural(busy.count, 'design')} · usually 15–40 s`]
          : ['Making the final 2K image…', 'One realism pass over the whole image · usually 20–60 s'];
    canvas = (
      <div className="canvas-loading" style={size}>
        <img src={busy.base} alt="" />
        <span className="scan" aria-hidden="true" />
        <div className="loading-card">
          <span className="spinner" />
          <div>
            <strong>{title}</strong>
            <span>
              {detail} · <b>{elapsed}s</b>
            </span>
          </div>
        </div>
      </div>
    );
  } else if (shown === 'final' && final) {
    canvas = (
      <CompareSlider key={final.id} before={current} after={final.image} ratio={ratio} label="final 2K image" beforeLabel="Edited" afterLabel={`Final · ${final.width}×${final.height}`} size={size} />
    );
  } else if (shown === 'compare' && last) {
    canvas = <CompareSlider key={last.id} before={original} after={current} ratio={ratio} label={plural(steps.length, 'change')} beforeLabel="Original" afterLabel={after} size={size} />;
  } else if (mode === 'mark') {
    canvas = <MaskEditor src={current} width={width} height={height} size={size} ops={ops} onOps={onOps} tool={tool} brush={brush} part={part} />;
  } else if (picking) {
    canvas = (
      <div className="canvas-frame picking" style={size}>
        <button type="button" className="pick-surface" onClick={pick} aria-label={`Pick where the ${picking} is`}>
          <img src={current} alt="" />
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
    );
  } else {
    canvas = (
      <div className="canvas-frame" style={size}>
        <img src={current} alt={last ? 'The image with your changes' : "The customer's photo"} />
        {pins}
        <span className="tag tag-left">{last ? after : 'Original'}</span>
      </div>
    );
  }

  return (
    <section className="stage" aria-live="polite" aria-busy={Boolean(busy)}>
      <div className="stage-head">
        {views.filter((v) => v.show).length > 1 && (
          <div className="segmented view-toggle" role="radiogroup" aria-label="View">
            {views
              .filter((v) => v.show)
              .map((v) => (
                <label key={v.id}>
                  <input type="radio" className="sr-only" name="view" checked={shown === v.id} onChange={() => onView(v.id)} />
                  <Icon name={v.icon} size={14} /> {v.label}
                </label>
              ))}
          </div>
        )}

        {options && !busy && (
          <div className="choose" role="radiogroup" aria-label="Use another option of the last design">
            <span className="field-label">Option</span>
            {options.variations.map((v, i) => (
              <button
                key={v.id}
                type="button"
                role="radio"
                aria-checked={i === options.chosen}
                className={`choose-opt${v.image ? '' : ' failed'}`}
                disabled={!v.image}
                onClick={() => onChoose(i)}
                title={v.image ? `Use ${v.label}` : `${v.label} didn't work: ${v.error ?? 'no image'}`}
              >
                {v.label.replace('Option ', '')}
              </button>
            ))}
          </div>
        )}

        {marking && (
          <div className="toolbar" role="toolbar" aria-label="Marking tools">
            <div className="tools" role="radiogroup" aria-label="Tool">
              {TOOLS.map((t) => (
                <button key={t.id} type="button" role="radio" aria-checked={tool === t.id} className="tool" title={t.title} onClick={() => onTool(t.id)}>
                  <Icon name={t.icon} size={15} /> {t.label}
                </button>
              ))}
            </div>
            {tool !== 'shape' && (
              <label className="brush-size" title="Brush size">
                <span className="sr-only">Brush size</span>
                <span className="brush-dot small" aria-hidden="true" />
                <input type="range" min={1} max={12} step={0.5} value={brushPct} onChange={(e) => onBrushPct(Number(e.target.value))} />
                <span className="brush-dot" aria-hidden="true" />
              </label>
            )}
            <span className="toolbar-sep" aria-hidden="true" />
            <button type="button" className="tool" onClick={() => onOps(ops.slice(0, -1))} disabled={!ops.length} title="Undo the last stroke (Ctrl+Z)">
              <Icon name="undo" size={15} />
              <span className="sr-only">Undo stroke</span>
            </button>
            <button type="button" className="tool" onClick={() => onOps([])} disabled={!ops.length} title="Clear the whole mark">
              <Icon name="trash" size={15} />
              <span className="sr-only">Clear mark</span>
            </button>
          </div>
        )}
      </div>

      {/* --ratio lets phones size this box to the image's shape (see studio.css). */}
      <div className="canvas" ref={canvasRef} style={{ '--ratio': ratio } as CSSProperties}>
        {canvas}
      </div>

      <div className="stage-foot">
        {steps.length ? (
          <ol className="changes" ref={listRef} aria-label="Changes made">
            {steps.map((s, i) => (
              <li key={s.id} title={`${s.label}: ${s.value}`}>
                <span className="change-num">{i + 1}</span>
                {s.hex && <span className="spec-dot" style={{ background: s.hex }} aria-hidden="true" />}
                <span className="change-label">{s.label}</span> {s.value}
              </li>
            ))}
          </ol>
        ) : (
          <p className="stage-hint">
            {mode === 'mark' ? (
              <>
                Pick a part, mark it on the photo, then <b>click a change</b>. At the end, make the <b>Final 2K</b> image.
              </>
            ) : (
              <>
                Set the new materials on the left, then press <b>Generate</b> <kbd>Ctrl</kbd> <kbd>↵</kbd>
              </>
            )}
          </p>
        )}

        {!busy && (
          <div className="stage-actions">
            {shown === 'final' && final ? (
              <>
                <button type="button" className="btn btn-ghost btn-sm" onClick={() => onView('edit')}>
                  Back to editing
                </button>
                <button type="button" className="btn btn-ghost btn-sm" onClick={onFinal} title="Make the final image again: the AI gives a slightly different result each time">
                  <Icon name="refresh" size={16} /> Try again
                </button>
                <button type="button" className="btn btn-accent btn-sm" onClick={onDownloadFinal}>
                  <Icon name="download" size={16} /> Download 2K
                </button>
              </>
            ) : (
              <>
                {last && (
                  <>
                    <button type="button" className="btn btn-ghost btn-sm" onClick={onUndo} title="Remove the last change and bring back its settings">
                      <Icon name="undo" size={16} /> Undo
                    </button>
                    <button type="button" className="btn btn-ghost btn-sm" onClick={onRetry} title="Make the last change again with the same settings">
                      <Icon name="refresh" size={16} /> Try again
                    </button>
                    <button type="button" className="btn btn-sm" onClick={onDownload} title={`Download the image as it is now (${width}×${height})`}>
                      <Icon name="download" size={16} />
                      {saved ? 'Downloaded' : 'Download'}
                    </button>
                  </>
                )}
                <button
                  type="button"
                  className="btn btn-accent btn-sm"
                  onClick={final ? () => onView('final') : onFinal}
                  title="Last step: the AI sharpens the whole image into a realistic 2K photo, ready to download"
                >
                  <Icon name="hd" size={16} /> {final ? 'View final 2K' : 'Final 2K image'}
                </button>
              </>
            )}
          </div>
        )}
      </div>

      {!busy && unsaved && (
        <p className="save-note" role="status">
          <span className="dot" aria-hidden="true" />
          Not stored anywhere: download the result before closing this tab.
        </p>
      )}

      {debug && (shown === 'final' ? final : last) && (
        <details className="debug">
          <summary>
            Prompt sent to the AI {shown === 'final' ? 'for the final image' : `for change ${steps.length}`} · {(((shown === 'final' ? final : last)?.ms ?? 0) / 1000).toFixed(1)} s
          </summary>
          <pre>{(shown === 'final' ? final : last)?.prompt}</pre>
        </details>
      )}
    </section>
  );
}
