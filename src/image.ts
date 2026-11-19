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

export async function prepareImage(file: File): Promise<PreparedImage> {
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

  const scale = Math.min(1, MAX_SIDE / Math.max(bitmap.width, bitmap.height));
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

export function measureImage(src: string): Promise<{ width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve({ width: img.naturalWidth, height: img.naturalHeight });
    img.onerror = () => reject(new Error('Could not read the generated image.'));
    img.src = src;
  });
}
