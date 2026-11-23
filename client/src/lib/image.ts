export interface PreparedImage {
  dataUrl: string;
  width: number;
  height: number;
  name: string;
}

// Phone photos are 3000-4000px wide. AI models work at about 1-2K anyway,
// so shrinking first makes uploads fast and keeps request size small.
const MAX_SIDE = 1536;
const ACCEPTED = /^image\/(jpeg|png|webp)$/;

/** Material sample photos (Standard mode) only need to show colour, pattern and grain. */
export const SAMPLE_MAX_SIDE = 768;

/** Item photos (Mark & edit: "put this sofa here") keep a little more detail. */
export const ITEM_MAX_SIDE = 1024;

export async function prepareImage(file: File, maxSide = MAX_SIDE): Promise<PreparedImage> {
  if (/heic|heif/i.test(file.type) || /\.(heic|heif)$/i.test(file.name)) {
    throw new Error('HEIC photos are not supported yet. On iPhone, share the photo as JPG, or set Camera → Formats → Most Compatible.');
  }
  if (!ACCEPTED.test(file.type)) throw new Error('Please upload a JPG, PNG or WebP photo.');

  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file); // applies the photo's EXIF rotation
  } catch {
    throw new Error('Could not read this image. Try another photo.');
  }

  const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height));
  const width = Math.round(bitmap.width * scale);
  const height = Math.round(bitmap.height * scale);

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Your browser could not process this image.');
  ctx.fillStyle = '#fff'; // flatten transparent PNGs onto white
  ctx.fillRect(0, 0, width, height);
  ctx.drawImage(bitmap, 0, 0, width, height);
  bitmap.close();

  return { dataUrl: canvas.toDataURL('image/jpeg', 0.9), width, height, name: file.name };
}

/** Reads any image URL (blob: or data:) as a data URL, the form the API accepts. */
export async function toDataUrl(url: string): Promise<string> {
  if (url.startsWith('data:')) return url;
  const blob = await (await fetch(url)).blob();
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(new Error('Could not read the image.'));
    reader.readAsDataURL(blob);
  });
}
