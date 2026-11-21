// Turns a hex colour into words. Image models follow "a muted greyish green"
// far better than "#7A8B6F", so a custom colour is sent as both.

const HEX = /^#[0-9a-f]{6}$/i;

export const isHex = (value: string) => HEX.test(value);

function toHsl(hex: string): [number, number, number] {
  const n = parseInt(hex.slice(1), 16);
  const r = ((n >> 16) & 255) / 255;
  const g = ((n >> 8) & 255) / 255;
  const b = (n & 255) / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  if (max === min) return [0, 0, l];
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  const h = max === r ? ((g - b) / d + (g < b ? 6 : 0)) * 60 : max === g ? ((b - r) / d + 2) * 60 : ((r - g) / d + 4) * 60;
  return [h, s, l];
}

const HUES: [number, string][] = [
  [12, 'red'],
  [38, 'orange'],
  [52, 'mustard yellow'],
  [68, 'yellow'],
  [95, 'olive green'],
  [160, 'green'],
  [190, 'teal'],
  [215, 'sky blue'],
  [250, 'blue'],
  [285, 'purple'],
  [330, 'pink'],
  [360, 'red'],
];

/** "#9AA98F" -> "a light muted green". Rough on purpose: it only needs to steer the AI. */
export function describeHex(hex: string): string {
  const [h, s, l] = toHsl(hex);

  if (s < 0.08 || (l > 0.94 && s < 0.4) || l < 0.08) {
    if (l > 0.94) return 'white';
    if (l > 0.82) return 'an off-white';
    if (l > 0.62) return 'a light grey';
    if (l > 0.38) return 'a mid grey';
    if (l > 0.16) return 'a dark charcoal grey';
    return 'black';
  }

  // Low-saturation warm colours are what Indian interiors call beige, greige and cream.
  if (s < 0.35 && h >= 20 && h <= 60) {
    if (l > 0.82) return 'a cream';
    if (l > 0.62) return 'a beige';
    if (l > 0.4) return 'a greige (warm grey-beige)';
    return 'a deep warm brown';
  }

  let hue = HUES.find(([limit]) => h < limit)![1];
  if (hue === 'orange' && l < 0.45) hue = 'brown';
  else if (hue === 'orange' && s < 0.55) hue = 'terracotta';
  if (hue === 'sky blue' && l < 0.55) hue = 'blue';
  if (hue === 'red' && l < 0.3) hue = 'burgundy';
  if (hue === 'blue' && l < 0.3) hue = 'navy blue';

  const tone = l > 0.8 ? 'pale ' : l > 0.64 ? 'light ' : l < 0.25 ? 'very dark ' : l < 0.4 ? 'deep ' : '';
  const chroma = s < 0.25 ? 'muted greyish ' : s < 0.5 ? 'muted ' : s > 0.8 && l > 0.3 && l < 0.7 ? 'bold ' : '';
  const words = `${tone}${chroma}${hue}`;
  return /^[aeiou]/.test(words) ? `an ${words}` : `a ${words}`;
}
