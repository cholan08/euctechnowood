import { z } from 'zod';
import { INSTRUCTION_MAX, ROOM_TYPES } from '@shared/catalog';
import { RequestError } from './errors';
import { DATA_URL } from './image';

// Building blocks for the request schemas in each module. Every field carries a
// message staff can understand, because the first failing one is shown as-is.

export type Room = (typeof ROOM_TYPES)[number];

const roomIds = ROOM_TYPES.map((r) => r.id) as [string, ...string[]];

export const unit = z.number().min(0).max(1);

export const roomTypeField = z.enum(roomIds, { error: 'Choose a room type.' });

/** Fields every image request has. */
export const imageFields = {
  image: z.string({ error: 'Upload a JPG, PNG or WebP image.' }).regex(DATA_URL, 'Upload a JPG, PNG or WebP image.'),
  width: z.number({ error: 'Missing image size.' }).positive('Missing image size.'),
  height: z.number({ error: 'Missing image size.' }).positive('Missing image size.'),
  roomType: roomTypeField,
};

/** A finish picked for one part (ids from the catalogue, resolved later). */
export const selectionFields = {
  material: z.string().max(40),
  shade: z.string().max(40).optional(),
  colour: z.string().max(7).optional(),
  finish: z.string().max(40).optional(),
  details: z.string().max(INSTRUCTION_MAX + 40, `Keep the details under ${INSTRUCTION_MAX} characters.`).optional(),
};

/** Checks `body` against `schema`; the first problem becomes a RequestError (400). */
export function parseBody<T extends z.ZodType>(schema: T, body: unknown): z.infer<T> {
  const result = schema.safeParse(body ?? {});
  if (!result.success) throw new RequestError(result.error.issues[0]?.message ?? 'Invalid request.');
  return result.data;
}

/** A room id that already passed roomTypeField. */
export const findRoom = (id: string): Room => ROOM_TYPES.find((r) => r.id === id)!;
