import { context, drawOps, makeCanvas, type MaskOp } from './mask';

// The AI redraws the WHOLE image on every edit, so its output drifts from the real
// photo: textures, objects, light. We only keep the area staff marked and paste it
// back onto the real image. Everything outside the mark stays the original pixels.
//
// Two things make the pasted area sit right:
// 1. Alignment. The edit API may return a different size or a slightly shifted,
//    zoomed frame. We search a small range of zoom and shift that best matches the
//    unmarked parts (which should look the same in both).
// 2. Exposure. If the AI brightened or warmed the whole image, the new part would
//    look out of place, so its colour is scaled to match the real photo around it.

/** How to place the AI image on the base: zoom about the centre, then shift (base pixels). */
interface Fit {
  scale: number;
  dx: number;
  dy: number;
  /** Per-channel colour gain that matches the AI image's exposure to the real photo. */
  gains: [number, number, number];
}

/**
 * Pastes the marked area of the AI's image onto the base image.
 * Returns a blob URL of the result (JPEG, same size as the base).
 */
export async function pasteBack(baseUrl: string, aiUrl: string, ops: readonly MaskOp[], width: number, height: number): Promise<string> {
  const [base, ai] = await Promise.all([loadBitmap(baseUrl), loadBitmap(aiUrl)]);
  try {
    const fit = estimateFit(base, ai, ops, width, height);

    // 1. The AI image, lined up with the base and matched to its exposure.
    const layer = makeCanvas(width, height);
    const ctx = context(layer);
    ctx.imageSmoothingQuality = 'high';
    const w = width * fit.scale;
    const h = height * fit.scale;
    ctx.drawImage(ai, (width - w) / 2 + fit.dx, (height - h) / 2 + fit.dy, w, h);
    applyGains(ctx, width, height, fit.gains);

    // 2. Only the marked area, with a soft edge so the seam does not show.
    ctx.globalCompositeOperation = 'destination-in';
    ctx.drawImage(softMask(ops, width, height), 0, 0);

    // 3. On top of the real image.
    const out = makeCanvas(width, height);
    const octx = context(out);
    octx.drawImage(base, 0, 0, width, height);
    octx.drawImage(layer, 0, 0);
    return URL.createObjectURL(await toJpeg(out));
  } finally {
    base.close();
    ai.close();
  }
}

/**
 * The final 2K image, lined up with the image it was made from and cut to the same
 * shape. The AI may return a slightly different frame (xAI "2k" gave 2912×1456 for a
 * 1.99:1 photo), so the same zoom/shift search places it. No exposure match here:
 * better light is the point of the final pass. Keeps the AI's full detail, never
 * upscales beyond it.
 */
export async function fitToFrame(baseUrl: string, aiUrl: string, width: number, height: number, maxSide = 3072): Promise<{ url: string; width: number; height: number }> {
  const [base, ai] = await Promise.all([loadBitmap(baseUrl), loadBitmap(aiUrl)]);
  try {
    const fit = estimateFit(base, ai, [], width, height);
    // The AI's frame must cover the whole picture: a sliver of the original at an edge
    // would show the old, softer image (or a drawing's dimension lines). Zoom in just
    // enough to cover instead.
    const cover = Math.max(1 + (2 * Math.abs(fit.dx)) / width, 1 + (2 * Math.abs(fit.dy)) / height);
    // (Plus a pixel each side, so a smoothed edge never shows.)
    const scale = fit.scale < cover ? cover + 2 / Math.min(width, height) : fit.scale;
    const k = clamp(Math.max(ai.width / width, ai.height / height), 1, maxSide / Math.max(width, height));
    const out = makeCanvas(Math.round(width * k), Math.round(height * k));
    const ctx = context(out);
    ctx.imageSmoothingQuality = 'high';
    const w = width * scale;
    const h = height * scale;
    ctx.drawImage(ai, ((width - w) / 2 + fit.dx) * k, ((height - h) / 2 + fit.dy) * k, w * k, h * k);
    return { url: URL.createObjectURL(await toJpeg(out)), width: out.width, height: out.height };
  } finally {
    base.close();
    ai.close();
  }
}

async function loadBitmap(url: string): Promise<ImageBitmap> {
  const response = await fetch(url);
  if (!response.ok) throw new Error('Could not read the image.');
  return createImageBitmap(await response.blob());
}

function toJpeg(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) =>
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error('Could not create the image.'))), 'image/jpeg', 0.92),
  );
}

/** The mask at full size with its edge blurred over a few pixels. */
function softMask(ops: readonly MaskOp[], width: number, height: number): HTMLCanvasElement {
  const hard = makeCanvas(width, height);
  drawOps(context(hard), ops);
  const feather = Math.max(2, Math.round(Math.max(width, height) * 0.003)); // about 5 px on a 1536 px photo
  const soft = makeCanvas(width, height);
  const ctx = context(soft);
  // Older Safari has no canvas filter (the property is missing).
  if (typeof ctx.filter === 'string') {
    ctx.filter = `blur(${feather}px)`;
    ctx.drawImage(hard, 0, 0);
  } else {
    // Shrinking then enlarging softens the edge just as well.
    const small = makeCanvas(width / feather, height / feather);
    context(small).drawImage(hard, 0, 0, small.width, small.height);
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(small, 0, 0, width, height);
  }
  return soft;
}

function applyGains(ctx: CanvasRenderingContext2D, width: number, height: number, gains: Fit['gains']): void {
  if (gains.every((g) => Math.abs(g - 1) < 0.01)) return;
  const img = ctx.getImageData(0, 0, width, height);
  const d = img.data;
  for (let i = 0; i < d.length; i += 4) {
    d[i] = d[i] * gains[0];
    d[i + 1] = d[i + 1] * gains[1];
    d[i + 2] = d[i + 2] * gains[2];
  }
  ctx.putImageData(img, 0, 0);
}

// ---------------------------------------------------------------- alignment

/** Both images at one small size, plus where they should match (outside the mark). */
interface Sample {
  w: number;
  h: number;
  baseRgb: Uint8ClampedArray;
  aiRgb: Uint8ClampedArray;
  base: Float32Array;
  ai: Float32Array;
  /** 1 where the pixel is far enough from the mark to compare. */
  valid: Uint8Array;
  validCount: number;
  /** Brightness ratio base / AI over the valid pixels, so exposure does not bias the search. */
  gain: number;
}

const IDENTITY: Fit = { scale: 1, dx: 0, dy: 0, gains: [1, 1, 1] };

/**
 * Coarse to fine: the first pass tries zoom ±6% and shift ±4% on a 160 px copy;
 * each later pass searches close to the previous answer on a larger copy.
 */
const PASSES = [
  { size: 160, zoom: 0.06, zoomStep: 0.01, shift: 6 },
  { size: 480, zoom: 0.01, zoomStep: 0.0025, shift: 3 },
  { size: 1024, zoom: 0.002, zoomStep: 0.001, shift: 2 },
];

function estimateFit(base: ImageBitmap, ai: ImageBitmap, ops: readonly MaskOp[], width: number, height: number): Fit {
  let best: Placement = { scale: 1, dx: 0, dy: 0 };
  let prev: Sample | null = null;
  for (const pass of PASSES) {
    const s = sample(base, ai, ops, width, height, Math.min(pass.size, Math.max(width, height)));
    // When the mark covers nearly the whole image there is nothing to line up against.
    if (!prev && s.validCount < s.w * s.h * 0.05) return IDENTITY;
    // The previous answer, in this pass's pixels.
    const cx = prev ? Math.round((best.dx * s.w) / prev.w) : 0;
    const cy = prev ? Math.round((best.dy * s.h) / prev.h) : 0;
    best = search(
      s,
      steps(best.scale - pass.zoom, best.scale + pass.zoom, pass.zoomStep),
      steps(cx - pass.shift, cx + pass.shift, 1),
      steps(cy - pass.shift, cy + pass.shift, 1),
    );
    prev = s;
  }
  const last = prev!;
  return { scale: best.scale, dx: (best.dx * width) / last.w, dy: (best.dy * height) / last.h, gains: colourGains(last, best) };
}

function steps(from: number, to: number, step: number): number[] {
  const out: number[] = [];
  for (let v = from; v <= to + step / 2; v += step) out.push(Math.round(v * 1000) / 1000);
  return out;
}

function sample(base: ImageBitmap, ai: ImageBitmap, ops: readonly MaskOp[], width: number, height: number, size: number): Sample {
  const scale = size / Math.max(width, height);
  const w = Math.max(8, Math.round(width * scale));
  const h = Math.max(8, Math.round(height * scale));
  const pixels = (img: ImageBitmap) => {
    const ctx = context(makeCanvas(w, h));
    ctx.drawImage(img, 0, 0, w, h); // the AI image is stretched to the base's shape first
    return ctx.getImageData(0, 0, w, h).data;
  };
  const baseRgb = pixels(base);
  const aiRgb = pixels(ai);

  // The mark, grown by about 1.5% of the image: shadows and reflections next to the
  // changed part may differ too, so they are left out of the comparison.
  const maskCanvas = makeCanvas(w, h);
  const mctx = context(maskCanvas);
  drawOps(mctx, ops, w / width);
  const grow = Math.max(2, Math.round(Math.max(w, h) * 0.015));
  const grown = makeCanvas(w, h);
  const gctx = context(grown);
  for (const r of [grow / 2, grow]) {
    for (const [ox, oy] of [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]]) gctx.drawImage(maskCanvas, ox * r, oy * r);
  }
  gctx.drawImage(maskCanvas, 0, 0);
  const marked = gctx.getImageData(0, 0, w, h).data;

  const baseGrey = new Float32Array(w * h);
  const aiGrey = new Float32Array(w * h);
  const valid = new Uint8Array(w * h);
  let validCount = 0;
  let sumBase = 0;
  let sumAi = 0;
  for (let i = 0; i < w * h; i++) {
    const j = i * 4;
    baseGrey[i] = 0.299 * baseRgb[j] + 0.587 * baseRgb[j + 1] + 0.114 * baseRgb[j + 2];
    aiGrey[i] = 0.299 * aiRgb[j] + 0.587 * aiRgb[j + 1] + 0.114 * aiRgb[j + 2];
    if (marked[j + 3] > 0) continue;
    valid[i] = 1;
    validCount++;
    sumBase += baseGrey[i];
    sumAi += aiGrey[i];
  }
  const gain = sumAi > 0 ? clamp(sumBase / sumAi, 0.7, 1.4) : 1;
  return { w, h, baseRgb, aiRgb, base: baseGrey, ai: aiGrey, valid, validCount, gain };
}

interface Placement {
  scale: number;
  dx: number;
  dy: number;
}

/** Tries every combination and keeps the one where the unmarked areas match best. */
function search(s: Sample, scales: number[], dxs: number[], dys: number[]): Placement {
  const { w, h, base, ai, valid, gain } = s;
  const stride = 2;
  const minSamples = Math.max(50, s.validCount / (stride * stride) / 4);
  let best: Placement = { scale: 1, dx: 0, dy: 0 };
  let bestScore = Infinity;

  for (const scale of scales) {
    for (const dy of dys) {
      const oy = (h - h * scale) / 2 + dy;
      for (const dx of dxs) {
        const ox = (w - w * scale) / 2 + dx;
        let sum = 0;
        let n = 0;
        for (let y = 0; y < h; y += stride) {
          const sy = Math.round((y - oy) / scale);
          if (sy < 0 || sy >= h) continue;
          const row = y * w;
          const srow = sy * w;
          for (let x = 0; x < w; x += stride) {
            if (!valid[row + x]) continue;
            const sx = Math.round((x - ox) / scale);
            if (sx < 0 || sx >= w) continue;
            sum += Math.abs(base[row + x] - ai[srow + sx] * gain);
            n++;
          }
        }
        if (n < minSamples) continue;
        // A tiny cost for moving, so "no change" wins a tie.
        const score = sum / n + 0.03 * (Math.abs(1 - scale) * 100 + (Math.abs(dx) / w + Math.abs(dy) / h) * 100);
        if (score < bestScore) {
          bestScore = score;
          best = { scale, dx, dy };
        }
      }
    }
  }
  return best;
}

/** Per-channel base / AI ratio over the unmarked pixels, with the AI image placed as found. */
function colourGains(s: Sample, p: Placement): Fit['gains'] {
  const { w, h, baseRgb, aiRgb, valid } = s;
  const ox = (w - w * p.scale) / 2 + p.dx;
  const oy = (h - h * p.scale) / 2 + p.dy;
  const sumBase = [0, 0, 0];
  const sumAi = [0, 0, 0];
  let n = 0;
  for (let y = 0; y < h; y++) {
    const sy = Math.round((y - oy) / p.scale);
    if (sy < 0 || sy >= h) continue;
    for (let x = 0; x < w; x++) {
      const i = y * w + x;
      if (!valid[i]) continue;
      const sx = Math.round((x - ox) / p.scale);
      if (sx < 0 || sx >= w) continue;
      const a = i * 4;
      const b = (sy * w + sx) * 4;
      for (let c = 0; c < 3; c++) {
        sumBase[c] += baseRgb[a + c];
        sumAi[c] += aiRgb[b + c];
      }
      n++;
    }
  }
  if (n < 200) return [1, 1, 1];
  return [0, 1, 2].map((c) => (sumAi[c] > 0 ? clamp(sumBase[c] / sumAi[c], 0.85, 1.18) : 1)) as Fit['gains'];
}

const clamp = (n: number, min: number, max: number) => Math.min(max, Math.max(min, n));
