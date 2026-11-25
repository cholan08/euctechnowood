import type { Variation } from '@shared/types';

const today = () => new Date().toISOString().slice(0, 10);
const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'room';

/** "euc-kitchen-3-changes-2026-11-23.jpg" */
export function designFileName(room: string, changes: number): string {
  return `euc-${slug(room)}-${changes}-change${changes === 1 ? '' : 's'}-${today()}.jpg`;
}

/** "euc-kitchen-final-2k-2026-11-23.jpg" */
export const finalFileName = (room: string) => `euc-${slug(room)}-final-2k-${today()}.jpg`;

/** Starts a browser download of an image URL (blob or data URL). */
export function downloadImage(url: string, fileName: string): void {
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  document.body.append(a);
  a.click();
  a.remove();
}

/** A data URL from the server as an in-memory blob URL: large data URLs can fail to download, blob URLs always work. */
export async function toBlobUrl(dataUrl: string): Promise<string> {
  const blob = await (await fetch(dataUrl)).blob();
  return URL.createObjectURL(blob);
}

/** Standard results with their images as blob URLs. */
export const toBlobUrls = (variations: Variation[]): Promise<Variation[]> =>
  Promise.all(variations.map(async (v) => (v.image?.startsWith('data:') ? { ...v, image: await toBlobUrl(v.image) } : v)));

export function revokeImages(variations: Variation[]): void {
  for (const v of variations) if (v.image?.startsWith('blob:')) URL.revokeObjectURL(v.image);
}
