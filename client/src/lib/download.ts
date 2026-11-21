import type { Variation } from '../../../shared/types';

/**
 * Turns the data URLs from the server into in-memory blob URLs. Large data URLs
 * can fail to download in some browsers; blob URLs always work and use less memory.
 */
export async function toBlobUrls(variations: Variation[]): Promise<Variation[]> {
  return Promise.all(
    variations.map(async (v) => {
      if (!v.image?.startsWith('data:')) return v;
      const blob = await (await fetch(v.image)).blob();
      return { ...v, image: URL.createObjectURL(blob) };
    }),
  );
}

export function revokeBlobUrls(variations: Variation[]): void {
  for (const v of variations) if (v.image?.startsWith('blob:')) URL.revokeObjectURL(v.image);
}

const today = () => new Date().toISOString().slice(0, 10);

export function designFileName(v: Variation): string {
  const name = v.label.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'design';
  return `euc-design-${name}-${today()}.jpg`;
}

/** Starts a browser download of one design. */
export function downloadDesign(v: Variation): void {
  if (!v.image) return;
  const a = document.createElement('a');
  a.href = v.image;
  a.download = designFileName(v);
  document.body.append(a);
  a.click();
  a.remove();
}
