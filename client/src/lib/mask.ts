import type { Box } from '../../../shared/catalog';

/** A point in image pixels (the prepared photo's own size, not screen pixels). */
export interface Pt {
  x: number;
  y: number;
}

/**
 * What staff drew on the photo to mark the part to change, kept as vector
 * operations rather than pixels: cheap to store per change, easy to undo, and
 * redrawn at any size (the overlay, the small copies used for alignment, the
 * full-size paste-back mask).
 */
export type MaskOp =
  /** A brush or eraser stroke. `size` is the brush diameter in image pixels. */
  | { kind: 'brush'; erase: boolean; size: number; points: Pt[] }
  /** A filled shape from clicked corners, for straight-edged parts like cabinet fronts. */
  | { kind: 'shape'; points: Pt[] };

/** Draws one operation in `colour` at `scale` (1 = image pixels). Erasing clears what is underneath. */
export function drawOp(ctx: CanvasRenderingContext2D, op: MaskOp, scale = 1, colour = '#fff'): void {
  ctx.save();
  ctx.globalCompositeOperation = op.kind === 'brush' && op.erase ? 'destination-out' : 'source-over';
  ctx.fillStyle = colour;
  ctx.strokeStyle = colour;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.beginPath();
  const [first, ...rest] = op.points;
  if (!first) return ctx.restore();
  if (op.kind === 'shape') {
    ctx.moveTo(first.x * scale, first.y * scale);
    for (const p of rest) ctx.lineTo(p.x * scale, p.y * scale);
    ctx.closePath();
    ctx.fill();
  } else if (!rest.length) {
    // A single click is a round dab.
    ctx.arc(first.x * scale, first.y * scale, (op.size * scale) / 2, 0, Math.PI * 2);
    ctx.fill();
  } else {
    ctx.lineWidth = Math.max(1, op.size * scale);
    ctx.moveTo(first.x * scale, first.y * scale);
    for (const p of rest) ctx.lineTo(p.x * scale, p.y * scale);
    ctx.stroke();
  }
  ctx.restore();
}

export function drawOps(ctx: CanvasRenderingContext2D, ops: readonly MaskOp[], scale = 1, colour = '#fff'): void {
  for (const op of ops) drawOp(ctx, op, scale, colour);
}

export function makeCanvas(width: number, height: number): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(width));
  canvas.height = Math.max(1, Math.round(height));
  return canvas;
}

export function context(canvas: HTMLCanvasElement): CanvasRenderingContext2D {
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) throw new Error('Your browser could not process this image.');
  return ctx;
}

export interface MaskStats {
  /** Share of the image that is marked, 0–1. */
  coverage: number;
  /** Bounding box of the mark, 0–1; null when nothing is marked. */
  box: Box | null;
}

/** How much of the image is marked and where, measured on a small copy (fast enough to run after every stroke). */
export function maskStats(ops: readonly MaskOp[], width: number, height: number): MaskStats {
  if (!ops.length) return { coverage: 0, box: null };
  const scale = Math.min(1, 256 / Math.max(width, height));
  const canvas = makeCanvas(width * scale, height * scale);
  const ctx = context(canvas);
  drawOps(ctx, ops, scale);
  const { width: w, height: h } = canvas;
  const data = ctx.getImageData(0, 0, w, h).data;
  let count = 0;
  let minX = w;
  let minY = h;
  let maxX = -1;
  let maxY = -1;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (data[(y * w + x) * 4 + 3] < 128) continue;
      count++;
      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
    }
  }
  if (!count) return { coverage: 0, box: null };
  return { coverage: count / (w * h), box: { x: minX / w, y: minY / h, w: (maxX + 1 - minX) / w, h: (maxY + 1 - minY) / h } };
}
