// The client presentation board, drawn on a canvas in the browser: EUC's logo,
// client and project, the proposed design large, the original photo, up to two
// alternatives, the list of changes with colour swatches, the palette and notes.
// One 2400×1500 JPEG, ready to download, print or send on WhatsApp.

export interface BoardLine {
  label: string;
  value: string;
  hex?: string;
}

export interface BoardInput {
  title: string;
  client: string;
  project: string;
  room: string;
  designer: string;
  /** Image URLs (same origin). */
  before: string;
  designs: { name: string; url: string }[];
  /** What changes in the main design. */
  lines: BoardLine[];
  palette: string[];
  notes: string;
  /** "Concept, not the customer's room" for generated concepts of an empty room. */
  disclaimer: string;
}

const W = 2400;
const H = 1500;
const PAD = 72;
const INK = '#16181b';
const MUTED = '#6b7079';
const RULE = '#e4e5e7';
const FONT = "'Geist', 'Segoe UI', Roboto, system-ui, sans-serif";

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('An image for the board could not be loaded.'));
    img.src = src;
  });
}

/** Draws `img` to cover the box (cropping the overflow), with rounded corners. */
function cover(ctx: CanvasRenderingContext2D, img: HTMLImageElement, x: number, y: number, w: number, h: number, r = 18) {
  const scale = Math.max(w / img.width, h / img.height);
  const sw = w / scale;
  const sh = h / scale;
  ctx.save();
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
  ctx.clip();
  ctx.drawImage(img, (img.width - sw) / 2, (img.height - sh) / 2, sw, sh, x, y, w, h);
  ctx.restore();
}

function tag(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, dark = true) {
  ctx.font = `600 26px ${FONT}`;
  const w = ctx.measureText(text).width + 36;
  ctx.fillStyle = dark ? 'rgba(15,16,18,0.78)' : 'rgba(255,255,255,0.9)';
  ctx.beginPath();
  ctx.roundRect(x, y, w, 50, 25);
  ctx.fill();
  ctx.fillStyle = dark ? '#fff' : INK;
  ctx.textBaseline = 'middle';
  ctx.fillText(text, x + 18, y + 26);
}

/** Writes `text` in lines that fit `maxW`; returns the y after the last line. */
function wrap(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, maxW: number, lineH: number, maxLines = 3): number {
  const words = text.split(/\s+/);
  let line = '';
  let lines = 0;
  for (let i = 0; i < words.length; i++) {
    const test = line ? `${line} ${words[i]}` : words[i];
    if (ctx.measureText(test).width > maxW && line) {
      if (++lines === maxLines) {
        ctx.fillText(`${line}…`, x, y);
        return y + lineH;
      }
      ctx.fillText(line, x, y);
      y += lineH;
      line = words[i];
    } else line = test;
  }
  if (line) ctx.fillText(line, x, y);
  return y + lineH;
}

export async function renderBoard(input: BoardInput): Promise<Blob> {
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Your browser could not draw the board.');
  await document.fonts?.ready;

  const [logo, before, ...designs] = await Promise.all([loadImage('/brand/logo.png').catch(() => null), loadImage(input.before), ...input.designs.map((d) => loadImage(d.url))]);

  ctx.fillStyle = '#fafaf9';
  ctx.fillRect(0, 0, W, H);

  // ---- header
  if (logo) ctx.drawImage(logo, PAD, 46, (logo.width / logo.height) * 64, 64);
  ctx.textBaseline = 'alphabetic';
  ctx.fillStyle = INK;
  ctx.font = `600 52px ${FONT}`;
  ctx.textAlign = 'right';
  ctx.fillText(input.title, W - PAD, 92);
  ctx.font = `400 28px ${FONT}`;
  ctx.fillStyle = MUTED;
  const date = new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' });
  ctx.fillText(`${input.client} · ${input.project} · ${input.room} · ${date}${input.designer ? ` · ${input.designer}` : ''}`, W - PAD, 134);
  ctx.textAlign = 'left';
  ctx.fillStyle = RULE;
  ctx.fillRect(PAD, 168, W - PAD * 2, 2);

  // ---- images: the proposed design large, the original and alternatives on the right
  const top = 200;
  const mainW = 1480;
  const mainH = 900;
  const main = designs[0] ?? before;
  cover(ctx, main, PAD, top, mainW, mainH);
  tag(ctx, input.designs[0]?.name ?? 'Proposed design', PAD + 24, top + 24);

  const colX = PAD + mainW + 40;
  const colW = W - PAD - colX;
  const beforeH = designs.length > 1 ? 430 : mainH;
  cover(ctx, before, colX, top, colW, beforeH);
  tag(ctx, 'Before', colX + 24, top + 24);

  const alts = designs.slice(1, 3);
  if (alts.length) {
    const altY = top + beforeH + 40;
    const altH = mainH - beforeH - 40;
    const altW = (colW - (alts.length - 1) * 30) / alts.length;
    alts.forEach((img, i) => {
      const x = colX + i * (altW + 30);
      cover(ctx, img, x, altY, altW, altH);
      tag(ctx, input.designs[i + 1].name, x + 20, altY + 20);
    });
  }

  // ---- what changes, palette and notes
  const infoY = top + mainH + 56;
  ctx.fillStyle = INK;
  ctx.font = `600 30px ${FONT}`;
  ctx.fillText('What changes', PAD, infoY);
  const lines = input.lines.slice(0, 10);
  const colWidth = (mainW - 40) / 2;
  lines.forEach((l, i) => {
    const x = PAD + (i % 2) * (colWidth + 40);
    const y = infoY + 52 + Math.floor(i / 2) * 50;
    if (l.hex) {
      ctx.fillStyle = l.hex;
      ctx.beginPath();
      ctx.arc(x + 12, y - 9, 12, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = 'rgba(0,0,0,0.15)';
      ctx.lineWidth = 2;
      ctx.stroke();
    }
    const tx = x + (l.hex ? 36 : 0);
    ctx.font = `600 25px ${FONT}`;
    ctx.fillStyle = INK;
    const label = `${l.label}:`;
    ctx.fillText(label, tx, y);
    // A fixed gap: a trailing space is not measured the same way in every browser font.
    const lw = ctx.measureText(label).width + 10;
    ctx.font = `400 25px ${FONT}`;
    ctx.fillStyle = MUTED;
    let value = l.value;
    while (value.length > 4 && ctx.measureText(value).width > colWidth - lw - 40) value = `${value.slice(0, -4)}…`;
    ctx.fillText(value, tx + lw, y);
  });
  if (!lines.length) {
    ctx.font = `400 25px ${FONT}`;
    ctx.fillStyle = MUTED;
    ctx.fillText('As shown in the images.', PAD, infoY + 52);
  }

  if (input.palette.length) {
    ctx.fillStyle = INK;
    ctx.font = `600 30px ${FONT}`;
    ctx.fillText('Palette', colX, infoY);
    input.palette.slice(0, 6).forEach((hex, i) => {
      ctx.fillStyle = hex;
      ctx.beginPath();
      ctx.roundRect(colX + i * 96, infoY + 24, 80, 80, 14);
      ctx.fill();
      ctx.strokeStyle = 'rgba(0,0,0,0.12)';
      ctx.lineWidth = 2;
      ctx.stroke();
    });
  }
  if (input.notes) {
    const ny = infoY + (input.palette.length ? 150 : 0);
    ctx.fillStyle = INK;
    ctx.font = `600 30px ${FONT}`;
    ctx.fillText('Notes', colX, ny);
    ctx.font = `400 25px ${FONT}`;
    ctx.fillStyle = MUTED;
    wrap(ctx, input.notes, colX, ny + 44, colW, 36, input.palette.length ? 2 : 5);
  }

  // ---- footer
  ctx.font = `400 22px ${FONT}`;
  ctx.fillStyle = '#9a9ea6';
  ctx.fillText(input.disclaimer, PAD, H - 40);
  ctx.textAlign = 'right';
  ctx.fillText('EUC Technowood · Dream Studios', W - PAD, H - 40);
  ctx.textAlign = 'left';

  return new Promise((resolve, reject) => canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('The board could not be saved.'))), 'image/jpeg', 0.92));
}

export const blobToDataUrl = (blob: Blob): Promise<string> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(new Error('Could not read the board.'));
    reader.readAsDataURL(blob);
  });

export const BOARD_SIZE = { width: W, height: H };
