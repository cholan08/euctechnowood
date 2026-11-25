// Checks the paste-back (client/src/features/studio/lib/composite.ts) with a synthetic "AI" image that is
// zoomed, shifted, brighter and smaller than the photo, with the marked part recoloured.
// Needs the Vite dev server, which serves the TypeScript module: npm run dev:web
// Usage: node tests/ui/paste-back.check.mjs http://localhost:5173 /tmp/paste-back.jpg
import { writeFileSync } from 'node:fs';
import { connect, sleep } from './cdp.mjs';
const [, , base, out] = process.argv;
const c = await connect();
await c.send('Page.enable');
await c.send('Page.navigate', { url: base });
await sleep(1500);
const r = await c.evaluate(`(async () => {
  const { pasteBack } = await import('/src/features/studio/lib/composite.ts');
  const load = async (u) => createImageBitmap(await (await fetch(u)).blob());
  const cv = (w, h) => { const x = document.createElement('canvas'); x.width = w; x.height = h; return x; };
  const src = await load('/brand/manufactured.jpg');
  const W = 1536, H = Math.round(1536 * src.height / src.width);
  const base = cv(W, H); base.getContext('2d').drawImage(src, 0, 0, W, H);
  const baseUrl = base.toDataURL('image/jpeg', 0.95);
  const R = { x: 260, y: 470, w: 420, h: 220 };

  // Synthetic "AI" output: zoomed, shifted, brighter, smaller, with the marked part recoloured.
  function fake(S, DX, DY, bright) {
    const AW = 1024, AH = Math.round(1024 * H / W), k = AW / W;
    const ai = cv(AW, AH), g = ai.getContext('2d');
    const ox = (W - W * S) / 2 + DX, oy = (H - H * S) / 2 + DY;
    g.filter = 'brightness(' + bright + ')';
    g.drawImage(base, ox * k, oy * k, W * S * k, H * S * k);
    g.filter = 'none';
    g.fillStyle = 'rgb(200,30,30)';
    g.fillRect((ox + R.x * S) * k, (oy + R.y * S) * k, R.w * S * k, R.h * S * k);
    return ai.toDataURL('image/jpeg', 0.95);
  }

  const pad = 30;
  const ops = [{ kind: 'shape', points: [
    { x: R.x - pad, y: R.y - pad }, { x: R.x + R.w + pad, y: R.y - pad },
    { x: R.x + R.w + pad, y: R.y + R.h + pad }, { x: R.x - pad, y: R.y + R.h + pad } ] }];
  const ref = cv(W, H); ref.getContext('2d').drawImage(await load(baseUrl), 0, 0);
  const bd = ref.getContext('2d').getImageData(0, 0, W, H).data;

  async function measure(aiUrl) {
    const t0 = performance.now();
    const url = await pasteBack(baseUrl, aiUrl, ops, W, H);
    const ms = Math.round(performance.now() - t0);
    const o = cv(W, H); o.getContext('2d').drawImage(await load(url), 0, 0);
    const od = o.getContext('2d').getImageData(0, 0, W, H).data;
    const inMask = (x, y) => x >= R.x - pad && x < R.x + R.w + pad && y >= R.y - pad && y < R.y + R.h + pad;
    const dist = (x, y) => Math.max(R.x - pad - x, x - (R.x + R.w + pad), R.y - pad - y, y - (R.y + R.h + pad));
    let outSum = 0, outN = 0, outMax = 0, ringSum = 0, ringN = 0, red = [0, 0, 0], redN = 0;
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const i = (y * W + x) * 4;
      const d = (Math.abs(od[i] - bd[i]) + Math.abs(od[i + 1] - bd[i + 1]) + Math.abs(od[i + 2] - bd[i + 2])) / 3;
      if (dist(x, y) > 16) { outSum += d; outN++; outMax = Math.max(outMax, d); }
      // Ring: inside the mark but outside the recoloured part, away from both edges: real texture the AI kept.
      const inR = x >= R.x - 8 && x < R.x + R.w + 8 && y >= R.y - 8 && y < R.y + R.h + 8;
      if (inMask(x, y) && dist(x, y) < -10 && !inR) { ringSum += d; ringN++; }
      if (x >= R.x + 10 && x < R.x + R.w - 10 && y >= R.y + 10 && y < R.y + R.h - 10) { red[0] += od[i]; red[1] += od[i + 1]; red[2] += od[i + 2]; redN++; }
    }
    return { ms, outsideMeanDiff: +(outSum / outN).toFixed(2), outsideMaxDiff: Math.round(outMax), ringMeanDiff: +(ringSum / ringN).toFixed(2), partColour: red.map((v) => Math.round(v / redN)), url };
  }

  const aligned = await measure(fake(1.03, 15, -10, 1.1));
  const same = await measure(fake(1, 0, 0, 1));
  const big = await measure(fake(0.96, -40, 25, 0.92));
  const blob = await (await fetch(aligned.url)).blob();
  const b64 = await new Promise((res) => { const fr = new FileReader(); fr.onload = () => res(fr.result); fr.readAsDataURL(blob); });
  for (const m of [aligned, same, big]) delete m.url;
  return { W, H, aligned, same, big, image: b64 };
})()`);
writeFileSync(out, Buffer.from(r.image.split(',')[1], 'base64'));
delete r.image;
console.log(JSON.stringify(r, null, 2));
// Outside the mark must be the original photo (only JPEG noise); inside, the real texture the AI kept
// must line up (best possible is about 3; without alignment these cases score 14-17).
const ok = [r.aligned, r.same, r.big].every((m) => m.outsideMeanDiff < 1.5 && m.ringMeanDiff < 6.5);
console.log(ok ? 'PASS  paste-back keeps the photo outside the mark and lines up inside it' : 'FAIL  paste-back');
if (!ok) process.exitCode = 1;
c.close();
