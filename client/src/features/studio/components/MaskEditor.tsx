import { useEffect, useRef, useState, type MouseEvent, type PointerEvent } from 'react';
import { drawOp, drawOps, type MaskOp, type Pt } from '../lib/mask';
import type { Size } from '../../../lib/useFitSize';

export type Tool = 'brush' | 'shape' | 'eraser';

interface Props {
  src: string;
  /** The image's own size; the mark is stored in these pixels. */
  width: number;
  height: number;
  /** Size on screen. */
  size: Size;
  ops: MaskOp[];
  onOps: (ops: MaskOp[]) => void;
  tool: Tool;
  /** Brush diameter in image pixels. */
  brush: number;
  /** The part being marked, e.g. "base cabinets"; null before a part is picked. */
  part: string | null;
}

// Drawn in the accent colour; the overlay is see-through (studio.css) so the photo shows under it.
// The mark's colour: vivid blue, visible on wood, stone and white walls (tokens.css --mark).
const MARK = '#2f6bff';
// Clicking within this many screen pixels of the first corner closes the shape.
const CLOSE_PX = 12;

/** The photo with the mark drawn over it. Staff paint, click corners or erase to show exactly what changes. */
export function MaskEditor({ src, width, height, size, ops, onOps, tool, brush, part }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  // The brush stroke being drawn right now. Added to `ops` when the pointer is released.
  const live = useRef<MaskOp | null>(null);
  // Corners clicked so far with the shape tool.
  const [corners, setCorners] = useState<Pt[]>([]);
  const [hover, setHover] = useState<Pt | null>(null);
  const scale = size.width / width;

  useEffect(() => {
    const ctx = canvasRef.current?.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, width, height);
    drawOps(ctx, ops, 1, MARK);
  }, [ops, width, height]);

  // A half-drawn shape belongs to the shape tool and this mark.
  useEffect(() => setCorners([]), [tool, ops]);

  function closeShape(points: Pt[]) {
    setCorners([]);
    if (points.length >= 3) onOps([...ops, { kind: 'shape', points }]);
  }

  // Shape tool keys: Enter closes, Backspace removes the last corner, Esc cancels.
  useEffect(() => {
    if (!corners.length) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setCorners([]);
      else if (e.key === 'Backspace') setCorners((c) => c.slice(0, -1));
      else if (e.key === 'Enter' && !e.ctrlKey && !e.metaKey) closeShape(corners);
      else return;
      e.preventDefault();
      e.stopImmediatePropagation();
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  });

  function toImage(e: { clientX: number; clientY: number; currentTarget: Element }): Pt {
    const box = e.currentTarget.getBoundingClientRect();
    const clamp = (n: number) => Math.min(1, Math.max(0, n));
    return { x: clamp((e.clientX - box.left) / box.width) * width, y: clamp((e.clientY - box.top) / box.height) * height };
  }

  function paint(op: MaskOp) {
    const ctx = canvasRef.current?.getContext('2d');
    if (ctx) drawOp(ctx, op, 1, MARK);
  }

  function onPointerDown(e: PointerEvent<HTMLDivElement>) {
    if (tool === 'shape' || e.button !== 0) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    const op: MaskOp = { kind: 'brush', erase: tool === 'eraser', size: brush, points: [toImage(e)] };
    live.current = op;
    paint(op);
  }

  function onPointerMove(e: PointerEvent<HTMLDivElement>) {
    const p = toImage(e);
    setHover(p);
    const op = live.current;
    if (op?.kind !== 'brush') return;
    const last = op.points[op.points.length - 1];
    if (Math.hypot(p.x - last.x, p.y - last.y) < op.size * 0.08) return;
    op.points.push(p);
    paint({ ...op, points: [last, p] });
  }

  function onPointerUp() {
    const op = live.current;
    live.current = null;
    if (op) onOps([...ops, op]);
  }

  function onClick(e: MouseEvent<HTMLDivElement>) {
    if (tool !== 'shape') return;
    // The second click of a double-click closes the shape (the first one already added the corner).
    if (e.detail >= 2) return closeShape(corners);
    const p = toImage(e);
    const first = corners[0];
    if (corners.length >= 3 && Math.hypot(p.x - first.x, p.y - first.y) * scale < CLOSE_PX) return closeShape(corners);
    setCorners([...corners, p]);
  }

  const what = part ?? 'part';
  const banner = corners.length
    ? corners.length < 3
      ? `Click the next corner of the ${what}`
      : 'Click the first corner (or press Enter) to close the shape'
    : tool === 'shape'
      ? `Click each corner of the ${what}`
      : tool === 'eraser'
        ? 'Paint over the mark to remove it'
        : `Paint over the ${what}`;

  const r = 1 / scale; // one screen pixel, in image pixels
  const points = (list: Pt[]) => list.map((p) => `${p.x},${p.y}`).join(' ');

  return (
    <div
      className={`canvas-frame marking tool-${tool}`}
      style={size}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
      onPointerLeave={() => setHover(null)}
      onClick={onClick}
    >
      <img src={src} alt="The photo to mark" draggable={false} />
      <canvas ref={canvasRef} width={width} height={height} className="mask-layer" aria-hidden="true" />

      {corners.length > 0 && (
        <svg className="shape-layer" viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none" aria-hidden="true">
          <polygon points={points(hover ? [...corners, hover] : corners)} className="shape-fill" />
          <polyline points={points(hover ? [...corners, hover] : corners)} className="shape-line" />
          {corners.map((p, i) => (
            <circle key={i} cx={p.x} cy={p.y} r={(i === 0 && corners.length >= 3 ? 7 : 4.5) * r} className={i === 0 ? 'shape-dot first' : 'shape-dot'} />
          ))}
        </svg>
      )}

      {hover && tool !== 'shape' && (
        <span
          className="brush-cursor"
          style={{ width: brush * scale, height: brush * scale, left: hover.x * scale, top: hover.y * scale }}
          aria-hidden="true"
        />
      )}

      <div className="mark-banner" role="status">
        {banner}
        {corners.length > 0 && (
          <span className="mark-keys">
            <kbd>Esc</kbd> cancel
          </span>
        )}
      </div>
    </div>
  );
}
