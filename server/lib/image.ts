/** An image as the AI services take it: raw base64 plus its type. Never written to disk. */
export interface ImageData {
  mimeType: string;
  base64: string;
}

/** The only image form the API accepts from the browser. */
export const DATA_URL = /^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/]+={0,2})$/;

/** Splits a data URL that already matched DATA_URL. */
export function splitDataUrl(dataUrl: string): ImageData {
  const [, mimeType, base64] = DATA_URL.exec(dataUrl)!;
  return { mimeType, base64 };
}

export const toDataUrl = (image: ImageData) => `data:${image.mimeType};base64,${image.base64}`;
