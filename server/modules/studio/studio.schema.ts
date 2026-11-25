import { z } from 'zod';
import {
  ADDONS,
  ELEMENTS,
  INSTRUCTION_MAX,
  MAX_SAMPLES,
  MAX_VARIANTS,
  MOODS,
  NOTES_MAX,
  appliesTo,
  resolveSelection,
  type AddOn,
  type Box,
  type Choice,
  type ResolvedSelection,
  type RoomElement,
} from '@shared/catalog';
import type { EditAction } from '@shared/types';
import { DESIGN_STYLES, FURNITURE_NAME_MAX, MAX_CONCEPTS, MAX_FURNITURE, findPalette, type DesignStyle, type StylePalette } from '@shared/styles';
import { RequestError } from '../../lib/errors';
import { DATA_URL, splitDataUrl, type ImageData } from '../../lib/image';
import { findRoom, imageFields, parseBody, selectionFields, unit, type Room } from '../../lib/validation';

// What the studio endpoints accept. Each parser checks the body and resolves every
// id against the catalogue, so unknown ids never reach a prompt.

// ---------------------------------------------------------------- Mark & edit

export interface ParsedEdit {
  image: ImageData;
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
  reference: ImageData | null;
  area: Box;
  /** change: a finish or own words · remove: take the object away · add: put a new object in. */
  action: EditAction;
}

// Item photos are shrunk to 1024px in the browser, about 150 KB; this cap only stops abuse.
const REFERENCE_MAX_CHARS = 3_000_000;

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
  action: z.enum(['change', 'remove', 'add']).default('change'),
});

/** Checks the request and resolves every id against the catalogue. Unknown ids never reach the prompt. */
export function parseEditRequest(body: unknown): ParsedEdit {
  const b = parseBody(editSchema, body);
  const room = findRoom(b.roomType);

  // Remove: only the mark (and optional words saying what it is) are needed.
  if (b.action === 'remove') {
    return { image: splitDataUrl(b.image), width: b.width, height: b.height, room, element: null, change: null, text: b.text, reference: null, area: b.area, action: 'remove' };
  }
  if (b.action === 'add' && !b.text && !b.reference) throw new RequestError('Say what to add, or attach a photo of the item.');

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
    action: change ? 'change' : b.action,
  };
}

// ---------------------------------------------------------------- Standard

/** A material sample photo, sent to the AI after the room photo. */
export interface Sample extends ImageData {
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
  image: ImageData;
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
  const b = parseBody(redesignSchema, body);
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

// ---------------------------------------------------------------- Final 2K

export interface ParsedFinal {
  image: ImageData;
  width: number;
  height: number;
  room: Room;
}

const finalSchema = z.object(imageFields);

export function parseFinalRequest(body: unknown): ParsedFinal {
  const b = parseBody(finalSchema, body);
  return { image: splitDataUrl(b.image), width: b.width, height: b.height, room: findRoom(b.roomType) };
}

// ---------------------------------------------------------------- Generate (empty room → concepts)

export interface ParsedConcept {
  name: string;
  palette: StylePalette;
  /** The finishes for this concept, resolved against the catalogue. */
  changes: ResolvedSelection[];
}

export interface ParsedGenerate {
  image: ImageData;
  width: number;
  height: number;
  room: Room;
  style: DesignStyle;
  concepts: ParsedConcept[];
  furniture: string[];
  brief: string;
  mood: Choice | null;
}

const styleIds = DESIGN_STYLES.map((s) => s.id) as [string, ...string[]];

const generateSchema = z.object({
  ...imageFields,
  style: z.enum(styleIds, { error: 'Choose a design style.' }),
  concepts: z
    .array(z.object({ name: z.string().max(40).default(''), palette: z.string().max(40).default(''), elements: z.record(z.string(), z.object(selectionFields).extend({ profile: z.string().max(40).optional() })).default({}) }), {
      error: 'Add at least one concept.',
    })
    .min(1, 'Add at least one concept.')
    .max(MAX_CONCEPTS, `At most ${MAX_CONCEPTS} concepts at a time.`),
  furniture: z
    .array(z.string().max(FURNITURE_NAME_MAX, 'A furniture name is too long.'))
    .max(MAX_FURNITURE, `Pick at most ${MAX_FURNITURE} pieces of furniture.`)
    .default([]),
  brief: z
    .string()
    .max(NOTES_MAX, `Keep the brief under ${NOTES_MAX} characters.`)
    .default('')
    .transform((s) => s.replace(/\s+/g, ' ').trim()),
  mood: z.string().default(''),
});

/** Checks a Generate request and resolves the style, combinations and every finish against the catalogue. */
export function parseGenerateRequest(body: unknown): ParsedGenerate {
  const b = parseBody(generateSchema, body);
  const room = findRoom(b.roomType);
  const style = DESIGN_STYLES.find((s) => s.id === b.style)!;
  const elements = ELEMENTS.filter((e) => appliesTo(e, room.id));
  const concepts = b.concepts.map((c, i): ParsedConcept => ({
    name: c.name.trim() || `Concept ${i + 1}`,
    palette: findPalette(style, c.palette),
    changes: elements.flatMap((element) => {
      const sel = c.elements[element.id];
      const resolved = sel && resolveSelection(element, sel);
      return resolved ? [resolved] : [];
    }),
  }));
  const furniture = [...new Set(b.furniture.map((f) => f.replace(/\s+/g, ' ').trim()).filter(Boolean))];
  return { image: splitDataUrl(b.image), width: b.width, height: b.height, room, style, concepts, furniture, brief: b.brief, mood: MOODS.find((m) => m.id && m.id === b.mood) ?? null };
}
