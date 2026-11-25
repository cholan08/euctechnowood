import { describeBox, describeSelection, detailsSentence, finishPrompt, selectionPrompt } from '@shared/catalog';
import type { SpecLine } from '@shared/types';
import type { ImageData } from '../../lib/image';
import type { ImageRef } from '../../providers/types';
import type { ParsedConcept, ParsedEdit, ParsedFinal, ParsedGenerate, ParsedRedesign, ParsedVariant } from './studio.schema';

// Prompt shape follows xAI's edit guide (docs.x.ai, image prompting guide): lead
// with the change, then ONE sentence that holds everything else fixed. Opening
// with "keep everything" barely moves the image, and describing the whole scene
// again restages it (things drift, duplicate or change type). Tune against real photos.

/** "the wall cabinet shutters" without the explanations in brackets. */
const shortNoun = (noun: string) => noun.replace(/\s*\([^)]*\)/g, '').trim();

const capitalise = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

const list = (items: string[]) => (items.length < 2 ? items.join('') : `${items.slice(0, -1).join(', ')} and ${items.at(-1)}`);

const NO_EXTRAS = 'no people, text, logos or watermarks';

// ---------------------------------------------------------------- Mark & edit

// One change, one short instruction. The browser pastes back ONLY the area staff
// marked, so everything outside it stays the real photo whatever the AI does there.
// The prompt's job is therefore narrow: make the change look right inside the
// mark, and keep the camera exactly still so the pasted area lines up.
const EDIT_FIT = `Fit the new material to the real edges of the part, with true-to-scale grain, veins and tile joints, realistic reflections and soft contact shadows that match the existing light. Photorealistic; ${NO_EXTRAS}.`;
const EDIT_STILL = 'Leave everything else in the photo unchanged, with the same camera position, lens, perspective, framing and crop.';

export function buildEditPrompt({ room, element, change, text, reference, area, action }: ParsedEdit, ref: ImageRef): string {
  const where = describeBox(area);
  const intro = `Edit this photo of a ${room.label.toLowerCase()}.`;
  const place = where ? `the ${where}` : 'the marked part of the photo';

  // Remove: take the object away and rebuild what was behind it from the rest of the room.
  if (action === 'remove') {
    const what = text ? `the ${text.replace(/^(the|a|an)\s+/i, '').replace(/[.\s]+$/, '')}` : 'the object';
    return [
      `${intro} Remove ${what} in ${place} completely, including its shadow and reflection.`,
      'Fill the space with what would naturally be behind it: continue the existing wall, floor, cabinet fronts, tiles or countertop with the same material, pattern, grout lines and perspective, so it looks as if the object was never there.',
      'Do not put anything new in its place.',
      EDIT_STILL,
      `Match the existing light and shadows. Photorealistic; ${NO_EXTRAS}.`,
    ].join('\n');
  }

  // Add: a new object from staff's words (an item photo uses the reference branch below).
  if (action === 'add' && !reference) {
    return [
      `${intro} Add ${text.replace(/[.\s]+$/, '')} in ${place}.`,
      "Give it a realistic size for this room, resting naturally where it belongs (on the floor, a wall, a counter or the ceiling) in the correct perspective for the photo's camera, with soft contact shadows that match the room's light.",
      EDIT_STILL,
      `Photorealistic; ${NO_EXTRAS}.`,
    ].join('\n');
  }

  // An item from another photo (a sofa, a chair, a light) put into the marked area.
  if (reference) {
    const item = element ? `the ${element.label.toLowerCase()}` : 'the item';
    const room0 = ref(0);
    const item1 = ref(1);
    return [
      `Edit ${room0}, a photo of a ${room.label.toLowerCase()}. Put ${item} shown in ${item1} into ${room0}, in the ${where || 'middle of the photo'}, replacing whatever is there now${text ? `. ${capitalise(text.replace(/[.\s]+$/, ''))}` : ''}.`,
      `Copy it exactly from ${item1}: the same design, shape, proportions, colour, fabric or material and details. Take only the item itself, never the background, floor, walls, framing or lighting of ${item1}.`,
      `Give it a realistic size for this room, resting naturally where it belongs (on the floor, a wall or the ceiling) in the correct perspective for ${room0}'s camera, and match the room's light direction, colour temperature and soft contact shadows.`,
      `Leave everything else in ${room0} unchanged, with the same camera position, lens, perspective, framing and crop. Photorealistic; ${NO_EXTRAS}.`,
    ].join('\n');
  }

  if (change) {
    const el = change.element;
    const lines = [[`${intro} Change ${el.noun}${where ? `, in the ${where},` : ''} to ${finishPrompt(change)}.`, detailsSentence(change.details)].filter(Boolean).join(' ')];
    if (!el.reshape) {
      lines.push(
        `Keep ${shortNoun(el.noun)} exactly the same shape, size and outline${el.doors ? ', with every door and drawer line in the same place' : ''}; only the surface finish changes.`,
      );
    }
    lines.push(EDIT_STILL, EDIT_FIT);
    return lines.join('\n');
  }

  // Staff's own words. The part (if picked) and the area still point the AI at the right place.
  const target = element ? `${element.noun}${where ? `, in the ${where}` : ''}` : where ? `the ${where}` : 'the photo';
  return [
    `${intro} For ${target}: ${text.replace(/[.\s]+$/, '')}.`,
    element ? `Keep ${shortNoun(element.noun)} in the same place and at the same size.` : 'Keep the change inside that area.',
    EDIT_STILL,
    `Match the existing light, perspective and shadows. Photorealistic; ${NO_EXTRAS}.`,
  ].join('\n');
}

// ---------------------------------------------------------------- Standard

export interface Job {
  label: string;
  prompt: string;
  specs: SpecLine[];
  /** Sample photos to send after the room photo, in the order the prompt names them. */
  references: ImageData[];
}

// The customer's image IS the design: it is their real room, or the layout EUC
// drew in Cabinet Vision. So this is an edit of finishes, never a redesign.
const FIT =
  'Fit each new material to the real edges of its part, with true-to-scale grain, veins and tile joints, realistic reflections and soft contact shadows. Photorealistic, natural colours; no people, text, logos or watermarks.';

export function buildJobs(request: ParsedRedesign, ref: ImageRef): Job[] {
  return request.variants.map((v) => ({
    label: v.name,
    prompt: composePrompt(request, v, ref),
    specs: specSheet(v),
    references: v.samples.map(({ mimeType, base64 }) => ({ mimeType, base64 })),
  }));
}

function specSheet(v: ParsedVariant): SpecLine[] {
  const lines: SpecLine[] = v.changes.map((c) => ({ label: c.element.label, ...describeSelection(c) }));
  if (v.mood) lines.push({ label: 'Lighting', value: v.mood.label });
  if (v.addons.length) lines.push({ label: 'Add-ons', value: v.addons.map((a) => a.label).join(', ') });
  if (v.notes) lines.push({ label: 'Note', value: v.notes });
  return lines;
}

function composePrompt(request: ParsedRedesign, v: ParsedVariant, ref: ImageRef): string {
  const room = request.room.label.toLowerCase();
  const sampleRef = (dataUrl: string) => ref(1 + v.samples.findIndex((s) => s.dataUrl === dataUrl));

  const changes = [...v.changes.map((c) => selectionPrompt(c, c.sample ? sampleRef(c.sample) : undefined)), ...v.addons.map((a) => a.prompt)];
  if (v.mood?.prompt) changes.push(`Lighting: ${v.mood.prompt}`);
  if (v.notes) changes.push(`Designer's note: ${v.notes}`);
  const numbered = changes.map((c, i) => `${i + 1}. ${c}`);

  // Naming the parts that must not change holds them far better than "everything else".
  const locked = v.locked.map((e) => shortNoun(e.noun));
  const lockedClause = locked.length ? `, the current material, colour and finish of ${list(locked)}` : '';
  const hold = `every cabinet's position, size and door and drawer divisions, the appliances, windows, doors, wall positions and ceiling height${lockedClause}, and the same camera position, lens, perspective and crop`;

  const lines: string[] = [];
  if (request.source === 'render') {
    lines.push(
      `Turn this Cabinet Vision 3D render of a ${room} into a photorealistic interior photograph of the same design, as if shot by a professional interior photographer: real material textures, natural light falloff and soft shadows.`,
    );
    if (numbered.length) lines.push('', 'Also make these changes:', ...numbered);
    lines.push('', `Keep the design exactly as drawn: the same layout, ${hold}.`);
  } else {
    lines.push(`Edit this photo of the customer's own ${room} in an Indian home. Make these changes:`, ...numbered);
    lines.push('', `Keep everything else exactly as in the photo: the same room and layout, ${hold}.`);
  }

  if (v.samples.length) {
    const refs = v.samples.map((_, i) => ref(i + 1));
    const many = refs.length > 1;
    lines.push(
      '',
      `${capitalise(ref(0))} is the room to edit. ${list(refs)} ${many ? 'are photos of material samples' : 'is a photo of a material sample'}: take only colour, pattern, grain and texture from ${many ? 'them' : 'it'}, never ${many ? 'their' : 'its'} framing, lighting or background.`,
    );
  }

  lines.push('', FIT);
  return lines.join('\n');
}

// ---------------------------------------------------------------- Final 2K

// The last step: the same image, sharper and more photographic. Nothing may move
// or change material: the customer has already approved what is in it.
export function buildFinalPrompt({ room }: ParsedFinal): string {
  return [
    `Make this image of a ${room.label.toLowerCase()} look like a high-resolution photograph taken by a professional interior photographer.`,
    'Keep everything exactly as it is: the same layout, cabinets, furniture, appliances, objects and their positions, the same materials, colours, patterns and finishes, and the same camera position, lens, perspective, framing and crop.',
    `Only improve the image quality: crisp fine detail, natural material textures and grain, clean straight edges where materials meet, realistic light, reflections and soft shadows. Do not add, remove or restyle anything; ${NO_EXTRAS}.`,
  ].join('\n');
}

// ---------------------------------------------------------------- Generate (empty room → concepts)

// The photo is the customer's real, empty or unfinished room. The architecture is
// fixed: only finishes and furniture are added. Style words describe the LOOK of
// what is added and never ask for new openings, walls or a different camera.
const ARCHITECTURE =
  "This is a real photo of the customer's room. Keep the architecture exactly as it is: every wall and its position, every window, door and opening with its size and position, the ceiling height, beams, columns, switchboards and pipes, and the same camera position, lens, perspective, framing and crop. Do not add, move, resize or remove any wall, window or door.";

export function buildGenerateJobs(request: ParsedGenerate): Job[] {
  return request.concepts.map((concept) => ({
    label: `${concept.name} · ${concept.palette.label}`,
    prompt: generatePrompt(request, concept),
    specs: conceptSpecs(request, concept),
    references: [],
  }));
}

function conceptSpecs(request: ParsedGenerate, concept: ParsedConcept): SpecLine[] {
  const lines: SpecLine[] = [{ label: 'Style', value: `${request.style.label} · ${concept.palette.label}`, hex: concept.palette.colours[0] }];
  lines.push(...concept.changes.map((c) => ({ label: c.element.label, ...describeSelection(c) })));
  if (request.furniture.length) lines.push({ label: 'Furniture', value: request.furniture.join(', ') });
  if (request.mood) lines.push({ label: 'Lighting', value: request.mood.label });
  if (request.brief) lines.push({ label: 'Brief', value: request.brief });
  return lines;
}

function generatePrompt(request: ParsedGenerate, concept: ParsedConcept): string {
  const room = request.room.label.toLowerCase();
  const lines = [
    `Design and furnish this empty or unfinished ${room} in an Indian home, as a finished, lived-in interior photographed by a professional interior photographer.`,
    `Style: ${request.style.prompt}. Colour combination: ${concept.palette.label.toLowerCase()}.`,
    '',
    ARCHITECTURE,
  ];

  if (concept.changes.length) {
    lines.push('', 'Use these finishes:', ...concept.changes.map((c, i) => `${i + 1}. ${capitalise(shortNoun(c.element.label.toLowerCase()))}: ${finishPrompt(c)}.${c.details ? ` ${detailsSentence(c.details)}` : ''}`));
  }
  if (request.furniture.length) {
    lines.push(
      '',
      `Add this furniture, in the ${request.style.label.toLowerCase()} style (${request.style.furnitureLook}): ${list(request.furniture.map((f) => f.toLowerCase()))}.`,
      'Size every piece realistically for this room and place it where the floor space allows, keeping doors, windows and walkways clear.',
    );
  } else {
    lines.push('', `Add the furniture this ${room} needs, in the ${request.style.label.toLowerCase()} style, sized realistically and keeping doors, windows and walkways clear.`);
  }
  if (request.brief) lines.push('', `Designer's brief: ${request.brief.replace(/[.\s]+$/, '')}.`);
  lines.push('', request.mood?.prompt ? `Lighting: ${request.mood.prompt}` : "Lighting: keep the photo's natural light direction, and add warm interior lights that suit the design.");
  lines.push('', `Real material textures with true-to-scale grain, veins and tile joints, realistic reflections and soft contact shadows. Photorealistic, natural colours; ${NO_EXTRAS}.`);
  return lines.join('\n');
}
