import { z } from 'zod';
import {
  ADDONS,
  ELEMENTS,
  INSTRUCTION_MAX,
  MAX_SAMPLES,
  MAX_VARIANTS,
  MOODS,
  NOTES_MAX,
  ROOM_TYPES,
  appliesTo,
  cleanText,
  resolveSelection,
  type AddOn,
  type Box,
  type Choice,
  type ResolvedSelection,
  type RoomElement,
} from '../../shared/catalog';

/** A problem with what the browser sent; its message is safe to show the user. */
export class RequestError extends Error {}

type Room = (typeof ROOM_TYPES)[number];

interface ImagePart {
  mimeType: string;
  base64: string;
}

const DATA_URL = /^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/]+={0,2})$/;
const roomIds = ROOM_TYPES.map((r) => r.id) as [string, ...string[]];
const unit = z.number().min(0).max(1);

// Fields every request has. Each has a message the user can understand.
const imageFields = {
  image: z.string({ error: 'Upload a JPG, PNG or WebP image.' }).regex(DATA_URL, 'Upload a JPG, PNG or WebP image.'),
  width: z.number({ error: 'Missing image size.' }).positive('Missing image size.'),
  height: z.number({ error: 'Missing image size.' }).positive('Missing image size.'),
  roomType: z.enum(roomIds, { error: 'Choose a room type.' }),
};

function parse<T extends z.ZodType>(schema: T, body: unknown): z.infer<T> {
  const result = schema.safeParse(body ?? {});
  if (!result.success) throw new RequestError(result.error.issues[0]?.message ?? 'Invalid request.');
  return result.data;
}

function splitDataUrl(dataUrl: string): ImagePart {
  const [, mimeType, base64] = DATA_URL.exec(dataUrl)!;
  return { mimeType, base64 };
}

const findRoom = (id: string): Room => ROOM_TYPES.find((r) => r.id === id)!;

// ---------------------------------------------------------------- Mark & edit

export interface ParsedEdit {
  image: ImagePart;
  width: number;
  height: number;
  room: Room;
  /** The part, when staff picked one. */
  element: RoomElement | null;
  /** A finish from the catalogue... */
  change: ResolvedSelection | null;
  /** ...or staff's own words (may be empty when an item photo is given). */
  text: string;
  /** A photo of an item to put in the marked area. */
  reference: ImagePart | null;
  area: Box;
}

// Item photos are shrunk to 1024px in the browser, about 150 KB; this cap only stops abuse.
const REFERENCE_MAX_CHARS = 3_000_000;

const selectionFields = {
  material: z.string().max(40),
  shade: z.string().max(40).optional(),
  colour: z.string().max(7).optional(),
  finish: z.string().max(40).optional(),
  details: z.string().max(INSTRUCTION_MAX + 40, `Keep the details under ${INSTRUCTION_MAX} characters.`).optional(),
};

const editSchema = z.object({
  ...imageFields,
  part: z.string().max(40).optional(),
  finish: z.object(selectionFields).optional(),
  text: z
    .string()
    .max(INSTRUCTION_MAX, `Keep the instruction under ${INSTRUCTION_MAX} characters.`)
    .optional()
    .transform((s) => s?.replace(/\s+/g, ' ').trim() ?? ''),
  reference: z
    .string()
    .max(REFERENCE_MAX_CHARS, 'The item photo is too large.')
    .regex(DATA_URL, 'The item photo must be a JPG, PNG or WebP.')
    .optional(),
  area: z.object(
    { x: unit, y: unit, w: unit.refine((n) => n > 0), h: unit.refine((n) => n > 0) },
    { error: 'Mark the part on the photo first.' },
  ),
});

/** Checks the request and resolves every id against the catalogue. Unknown ids never reach the prompt. */
export function parseEditRequest(body: unknown): ParsedEdit {
  const b = parse(editSchema, body);
  const room = findRoom(b.roomType);

  let element: RoomElement | null = null;
  if (b.part) {
    element = ELEMENTS.find((e) => e.id === b.part && appliesTo(e, room.id)) ?? null;
    if (!element) throw new RequestError(`That part is not in a ${room.label.toLowerCase()}.`);
  }

  let change: ResolvedSelection | null = null;
  if (b.finish) {
    if (!element) throw new RequestError('Pick the part to change.');
    change = resolveSelection(element, b.finish);
    if (!change) throw new RequestError('Pick the new finish.');
  } else if (!b.text && !b.reference) {
    throw new RequestError('Pick a change, describe it in your own words, or add an item photo.');
  }

  return {
    image: splitDataUrl(b.image),
    width: b.width,
    height: b.height,
    room,
    element,
    change,
    text: change ? '' : b.text,
    // An item photo goes with staff's words, not with a finish from the catalogue.
    reference: !change && b.reference ? splitDataUrl(b.reference) : null,
    area: b.area,
  };
}

// ---------------------------------------------------------------- Standard

/** A material sample photo, sent to the AI after the room photo. */
export interface Sample extends ImagePart {
  dataUrl: string;
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

export interface ParsedRedesign {
  image: ImagePart;
  width: number;
  height: number;
  source: 'photo' | 'render';
  room: Room;
  variants: ParsedVariant[];
}

// The browser shrinks samples to 768px, about 100 KB; this cap only stops abuse.
const SAMPLE_MAX_CHARS = 2_000_000;

const standardSelection = z.object({
  ...selectionFields,
  profile: z.string().max(40).optional(),
  sample: z
    .string()
    .max(SAMPLE_MAX_CHARS, 'A sample photo is too large.')
    .regex(DATA_URL, 'Sample photos must be JPG, PNG or WebP.')
    .optional(),
  area: z.object({ x: unit, y: unit }).optional(),
});

const variant = z.object({
  name: z.string().max(40).default(''),
  elements: z.record(z.string(), standardSelection).default({}),
  addons: z.array(z.string()).max(ADDONS.length).default([]),
  mood: z.string().default(''),
  notes: z
    .string()
    .default('')
    .transform((s) => s.trim().slice(0, NOTES_MAX)),
});

const redesignSchema = z.object({
  ...imageFields,
  source: z.enum(['photo', 'render']).catch('photo'),
  variants: z
    .array(variant, { error: 'Add at least one design option.' })
    .min(1, 'Add at least one design option.')
    .max(MAX_VARIANTS, `At most ${MAX_VARIANTS} options at a time.`),
});

/** Checks a Standard request and resolves every id against the catalogue. */
export function parseRedesignRequest(body: unknown): ParsedRedesign {
  const b = parse(redesignSchema, body);
  const room = findRoom(b.roomType);
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
    const samples = [...new Set(changes.flatMap((c) => (c.sample ? [c.sample] : [])))].map((dataUrl) => ({ dataUrl, ...splitDataUrl(dataUrl) }));
    if (samples.length > MAX_SAMPLES) throw new RequestError(`${name} uses ${samples.length} sample photos; the limit is ${MAX_SAMPLES} per option.`);
    const addons = ADDONS.filter((a) => v.addons.includes(a.id) && appliesTo(a, room.id));
    const mood = MOODS.find((m) => m.id && m.id === v.mood) ?? null;

    // A render with no changes is still a valid request: "make it photoreal".
    if (b.source === 'photo' && !changes.length && !addons.length && !mood && !v.notes) {
      throw new RequestError(`${name} has no changes. Change at least one part of the room.`);
    }

    return { name, changes, samples, locked: elements.filter((e) => !changedIds.has(e.id)), addons, mood, notes: v.notes };
  });

  return { image: splitDataUrl(b.image), width: b.width, height: b.height, source: b.source, room, variants };
}

// ---------------------------------------------------------------- AI help

export interface ParsedAssist {
  kind: 'details' | 'change' | 'note';
  room: Room;
  element: RoomElement | null;
  /** The finish picked so far, if any. */
  finish: ResolvedSelection | null;
  text: string;
}

const assistSchema = z.object({
  kind: z.enum(['details', 'change', 'note']),
  roomType: imageFields.roomType,
  part: z.string().max(40).optional(),
  finish: z.object(selectionFields).optional(),
  text: z.string().max(NOTES_MAX + 40, 'That text is too long for AI help.').default(''),
});

export function parseAssistRequest(body: unknown): ParsedAssist {
  const b = parse(assistSchema, body);
  const room = findRoom(b.roomType);
  const element = (b.part && ELEMENTS.find((e) => e.id === b.part && appliesTo(e, room.id))) || null;
  const finish = element && b.finish ? resolveSelection(element, b.finish) : null;
  const text = cleanText(b.text, b.kind === 'note' ? NOTES_MAX : INSTRUCTION_MAX);
  return { kind: b.kind, room, element, finish, text };
}

// ---------------------------------------------------------------- Final 2K

export interface ParsedFinal {
  image: ImagePart;
  width: number;
  height: number;
  room: Room;
}

const finalSchema = z.object(imageFields);

export function parseFinalRequest(body: unknown): ParsedFinal {
  const b = parse(finalSchema, body);
  return { image: splitDataUrl(b.image), width: b.width, height: b.height, room: findRoom(b.roomType) };
}
