import { z } from 'zod';
import {
  ADDONS,
  ELEMENTS,
  MAX_SAMPLES,
  MAX_VARIANTS,
  MOODS,
  NOTES_MAX,
  ROOM_TYPES,
  appliesTo,
  resolveSelection,
  type AddOn,
  type Choice,
  type ResolvedSelection,
  type RoomElement,
} from '../../shared/catalog';

/** A problem with what the browser sent; its message is safe to show the user. */
export class RequestError extends Error {}

/** A material sample photo, sent to the AI after the room photo. */
export interface Sample {
  dataUrl: string;
  mimeType: string;
  base64: string;
}

export interface ParsedVariant {
  name: string;
  changes: ResolvedSelection[];
  /** Distinct sample photos used by this option's changes, in prompt order (image 1, 2...). */
  samples: Sample[];
  /** Elements of this room type that were not changed: the prompt locks them. */
  locked: RoomElement[];
  addons: AddOn[];
  mood: Choice | null;
  notes: string;
}

export interface ParsedRequest {
  image: { mimeType: string; base64: string };
  width: number;
  height: number;
  source: 'photo' | 'render';
  room: (typeof ROOM_TYPES)[number];
  variants: ParsedVariant[];
}

const DATA_URL = /^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/]+={0,2})$/;
const roomIds = ROOM_TYPES.map((r) => r.id) as [string, ...string[]];

// The browser shrinks samples to 768px, about 100 KB; this cap only stops abuse.
const SAMPLE_MAX_CHARS = 2_000_000;

const selection = z.object({
  material: z.string().max(40),
  shade: z.string().max(40).optional(),
  colour: z.string().max(7).optional(),
  finish: z.string().max(40).optional(),
  profile: z.string().max(40).optional(),
  sample: z
    .string()
    .max(SAMPLE_MAX_CHARS, 'A sample photo is too large.')
    .regex(DATA_URL, 'Sample photos must be JPG, PNG or WebP.')
    .optional(),
  area: z.object({ x: z.number().min(0).max(1), y: z.number().min(0).max(1) }).optional(),
});

const variant = z.object({
  name: z.string().max(40).default(''),
  elements: z.record(z.string(), selection).default({}),
  addons: z.array(z.string()).max(ADDONS.length).default([]),
  mood: z.string().default(''),
  notes: z
    .string()
    .default('')
    .transform((s) => s.trim().slice(0, NOTES_MAX)),
});

// Shape of the request. Each field has a message the user can understand.
const schema = z.object({
  image: z.string({ error: 'Upload a JPG, PNG or WebP image.' }).regex(DATA_URL, 'Upload a JPG, PNG or WebP image.'),
  width: z.number({ error: 'Missing image size.' }).positive('Missing image size.'),
  height: z.number({ error: 'Missing image size.' }).positive('Missing image size.'),
  source: z.enum(['photo', 'render']).catch('photo'),
  roomType: z.enum(roomIds, { error: 'Choose a room type.' }),
  variants: z
    .array(variant, { error: 'Add at least one design option.' })
    .min(1, 'Add at least one design option.')
    .max(MAX_VARIANTS, `At most ${MAX_VARIANTS} options at a time.`),
});

/** Checks the request and resolves every id against the catalogue. Unknown ids never reach the prompt. */
export function parseRedesignRequest(body: unknown): ParsedRequest {
  const result = schema.safeParse(body ?? {});
  if (!result.success) throw new RequestError(result.error.issues[0]?.message ?? 'Invalid request.');
  const b = result.data;
  const room = ROOM_TYPES.find((r) => r.id === b.roomType)!;
  const elements = ELEMENTS.filter((e) => appliesTo(e, room.id));

  const variants = b.variants.map((v, i): ParsedVariant => {
    const changes = elements.flatMap((element) => {
      const sel = v.elements[element.id];
      const resolved = sel && resolveSelection(element, sel);
      return resolved ? [resolved] : [];
    });
    const changedIds = new Set(changes.map((c) => c.element.id));
    const name = v.name || `Option ${String.fromCharCode(65 + i)}`;

    // The same sample can be used for several parts ("Same as base cabinets"): send it once.
    const samples = [...new Set(changes.flatMap((c) => (c.sample ? [c.sample] : [])))].map(toSample);
    if (samples.length > MAX_SAMPLES) throw new RequestError(`${name} uses ${samples.length} sample photos; the limit is ${MAX_SAMPLES} per option.`);
    const addons = ADDONS.filter((a) => v.addons.includes(a.id) && appliesTo(a, room.id));
    const mood = MOODS.find((m) => m.id && m.id === v.mood) ?? null;

    // A render with no changes is still a valid request: "make it photoreal".
    if (b.source === 'photo' && !changes.length && !addons.length && !mood && !v.notes) {
      throw new RequestError(`${name} has no changes. Change at least one part of the room.`);
    }

    return {
      name,
      changes,
      samples,
      locked: elements.filter((e) => !changedIds.has(e.id)),
      addons,
      mood,
      notes: v.notes,
    };
  });

  const [, mimeType, base64] = DATA_URL.exec(b.image)!;
  return { image: { mimeType, base64 }, width: b.width, height: b.height, source: b.source, room, variants };
}

function toSample(dataUrl: string): Sample {
  const [, mimeType, base64] = DATA_URL.exec(dataUrl)!;
  return { dataUrl, mimeType, base64 };
}
