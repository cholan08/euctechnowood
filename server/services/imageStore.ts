import { mkdirSync } from 'node:fs';
import { writeFile } from 'node:fs/promises';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { config } from '../config';

// Generated images live on disk under data/uploads and are served at /uploads.
// File names are random UUIDs, so a link is only known to whoever was given it.
// In production, swap this for S3 / R2 object storage (same two functions).
export const uploadsDir = path.join(config.dataDir, 'uploads');
mkdirSync(uploadsDir, { recursive: true });

const EXT: Record<string, string> = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' };

/** Saves a base64 image and returns its file name. */
export async function saveImage(mimeType: string, base64: string): Promise<string> {
  // Recreate the folder if it was deleted while the server was running.
  mkdirSync(uploadsDir, { recursive: true });
  const file = `${randomUUID()}.${EXT[mimeType] ?? 'png'}`;
  await writeFile(path.join(uploadsDir, file), Buffer.from(base64, 'base64'));
  return file;
}

export const imageUrl = (file: string) => `/uploads/${file}`;
