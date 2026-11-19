import {
  CHANGE_GROUPS,
  EXTRAS,
  MAX_STYLES,
  NOTES_MAX,
  ROOM_TYPES,
  STYLES,
  appliesTo,
  type CatalogOption,
  type StylePreset,
} from '../shared/catalog';
import type { RedesignRequest } from '../shared/types';

/** A problem with what the browser sent; its message is safe to show the user. */
export class RequestError extends Error {}

export interface ParsedRequest {
  image: { mimeType: string; base64: string };
  width: number;
  height: number;
  source: 'photo' | 'render';
  room: (typeof ROOM_TYPES)[number];
  styles: StylePreset[];
  changes: CatalogOption[];
  extras: CatalogOption[];
  notes: string;
}

const DATA_URL = /^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/]+={0,2})$/;

/** Checks the request and resolves every id against the catalogue. Unknown ids never reach the prompt. */
export function parseRedesignRequest(body: unknown): ParsedRequest {
  if (!body || typeof body !== 'object') throw new RequestError('Missing request body.');
  const b = body as Partial<RedesignRequest>;

  const match = typeof b.image === 'string' ? DATA_URL.exec(b.image) : null;
  if (!match) throw new RequestError('Upload a JPG, PNG or WebP image.');

  const width = Number(b.width);
  const height = Number(b.height);
  if (!(width > 0 && height > 0)) throw new RequestError('Missing image size.');

  const room = ROOM_TYPES.find((r) => r.id === b.roomType);
  if (!room) throw new RequestError('Choose a room type.');

  const source = b.source === 'render' ? 'render' : 'photo';

  const styleIds = Array.isArray(b.styleIds) ? [...new Set(b.styleIds)] : [];
  if (styleIds.length > MAX_STYLES) throw new RequestError(`Choose at most ${MAX_STYLES} styles.`);
  const styles = styleIds.map((id) => {
    const style = STYLES.find((s) => s.id === id);
    if (!style) throw new RequestError(`Unknown style "${String(id)}".`);
    return style;
  });

  const rawChanges = b.changes && typeof b.changes === 'object' && !Array.isArray(b.changes) ? b.changes : {};
  const changes = Object.entries(rawChanges).flatMap(([groupId, optionId]) => {
    const group = CHANGE_GROUPS.find((g) => g.id === groupId);
    if (!group || !appliesTo(group, room.id)) return [];
    const option = group.options.find((o) => o.id === optionId);
    return option ? [option] : [];
  });

  const extras = (Array.isArray(b.extras) ? b.extras : []).flatMap((id) => {
    const extra = EXTRAS.find((e) => e.id === id);
    return extra && appliesTo(extra, room.id) ? [extra] : [];
  });

  const notes = typeof b.notes === 'string' ? b.notes.trim().slice(0, NOTES_MAX) : '';

  // A render with no changes is still a valid request: "make it photorealistic".
  if (source === 'photo' && !styles.length && !changes.length && !extras.length && !notes) {
    throw new RequestError('Pick at least one style or change.');
  }

  return {
    image: { mimeType: match[1], base64: match[2] },
    width,
    height,
    source,
    room,
    styles,
    changes,
    extras,
    notes,
  };
}
