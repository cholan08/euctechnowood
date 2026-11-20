import { z } from 'zod';
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
} from '../../shared/catalog';

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
const roomIds = ROOM_TYPES.map((r) => r.id) as [string, ...string[]];

// Shape of the request. Each field has a message the user can understand.
const schema = z.object({
  image: z.string({ error: 'Upload a JPG, PNG or WebP image.' }).regex(DATA_URL, 'Upload a JPG, PNG or WebP image.'),
  width: z.number({ error: 'Missing image size.' }).positive('Missing image size.'),
  height: z.number({ error: 'Missing image size.' }).positive('Missing image size.'),
  source: z.enum(['photo', 'render']).catch('photo'),
  roomType: z.enum(roomIds, { error: 'Choose a room type.' }),
  styleIds: z
    .array(z.string())
    .default([])
    .transform((ids) => [...new Set(ids)])
    .refine((ids) => ids.length <= MAX_STYLES, `Choose at most ${MAX_STYLES} styles.`),
  changes: z.record(z.string(), z.string()).default({}),
  extras: z.array(z.string()).default([]),
  notes: z
    .string()
    .default('')
    .transform((s) => s.trim().slice(0, NOTES_MAX)),
});

/** Checks the request and resolves every id against the catalogue. Unknown ids never reach the prompt. */
export function parseRedesignRequest(body: unknown): ParsedRequest {
  const result = schema.safeParse(body ?? {});
  if (!result.success) throw new RequestError(result.error.issues[0]?.message ?? 'Invalid request.');
  const b = result.data;

  const room = ROOM_TYPES.find((r) => r.id === b.roomType)!;

  const styles = b.styleIds.map((id) => {
    const style = STYLES.find((s) => s.id === id);
    if (!style) throw new RequestError(`Unknown style "${id}".`);
    return style;
  });

  const changes = Object.entries(b.changes).flatMap(([groupId, optionId]) => {
    const group = CHANGE_GROUPS.find((g) => g.id === groupId);
    if (!group || !appliesTo(group, room.id)) return [];
    const option = group.options.find((o) => o.id === optionId);
    return option ? [option] : [];
  });

  const extras = b.extras.flatMap((id) => {
    const extra = EXTRAS.find((e) => e.id === id);
    return extra && appliesTo(extra, room.id) ? [extra] : [];
  });

  // A render with no changes is still a valid request: "make it photoreal".
  if (b.source === 'photo' && !styles.length && !changes.length && !extras.length && !b.notes) {
    throw new RequestError('Pick at least one style or change.');
  }

  const [, mimeType, base64] = DATA_URL.exec(b.image)!;
  return {
    image: { mimeType, base64 },
    width: b.width,
    height: b.height,
    source: b.source,
    room,
    styles,
    changes,
    extras,
    notes: b.notes,
  };
}
