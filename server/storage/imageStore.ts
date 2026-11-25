import { mkdirSync } from 'node:fs';
import { readFile, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';

// Where image bytes live. The database keeps each image's record (room, kind,
// size, who made it); the store keeps the file under the same id. Disk today;
// an S3-style bucket can implement the same three calls later.

export interface ImageStore {
  put(id: string, bytes: Buffer): Promise<void>;
  /** The bytes, or null if the file is gone. */
  get(id: string): Promise<Buffer | null>;
  remove(id: string): Promise<void>;
}

const SAFE_ID = /^[0-9a-f-]{36}$/;

function checkId(id: string): string {
  // Ids are UUIDs we made; refuse anything else so a path can never be built from user input.
  if (!SAFE_ID.test(id)) throw new Error(`Bad image id: ${id}`);
  return id;
}

/** Files in `dir`, two levels of folders by id prefix so no folder grows huge. */
export function createDiskImageStore(dir: string): ImageStore {
  mkdirSync(dir, { recursive: true });
  const fileFor = (id: string) => path.join(dir, checkId(id).slice(0, 2), id);
  return {
    async put(id, bytes) {
      const file = fileFor(id);
      mkdirSync(path.dirname(file), { recursive: true });
      await writeFile(file, bytes);
    },
    async get(id) {
      try {
        return await readFile(fileFor(id));
      } catch (err) {
        if ((err as NodeJS.ErrnoException).code === 'ENOENT') return null;
        throw err;
      }
    },
    async remove(id) {
      await rm(fileFor(id), { force: true });
    },
  };
}

/** Keeps images in memory: for tests. */
export function createMemoryImageStore(): ImageStore & { size(): number } {
  const files = new Map<string, Buffer>();
  return {
    async put(id, bytes) {
      files.set(checkId(id), bytes);
    },
    async get(id) {
      return files.get(id) ?? null;
    },
    async remove(id) {
      files.delete(id);
    },
    size: () => files.size,
  };
}
