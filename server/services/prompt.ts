import { describeSelection, selectionPrompt } from '../../shared/catalog';
import type { SpecLine } from '../../shared/types';
import type { ImageData } from '../providers/types';
import type { ParsedRequest, ParsedVariant } from './validate';

export interface Job {
  label: string;
  prompt: string;
  specs: SpecLine[];
  /** Sample photos to send after the room photo, in the order the prompt names them. */
  references: ImageData[];
}

/** How the prompt names input image n (0 = the room photo). Comes from the AI provider. */
export type ImageRef = (index: number) => string;

// The customer's image IS the design: it is their real room, or the layout EUC
// drew in Cabinet Vision. So this is an edit of finishes, never a redesign.
//
// Shape follows xAI's edit guide (docs.x.ai, image prompting guide): lead with
// the changes, then ONE sentence that holds everything else fixed. Opening with
// "keep everything" barely moves the image, and describing the whole scene again
// restages it (things drift, duplicate or change type). Tune against real photos.
const FIT =
  'Fit each new material to the real edges of its part, with true-to-scale grain, veins and tile joints, realistic reflections and soft contact shadows. Photorealistic, natural colours; no people, text, logos or watermarks.';

export function buildJobs(request: ParsedRequest, ref: ImageRef): Job[] {
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

/** "the wall cabinet shutters" without the explanations in brackets, for the keep sentence. */
const shortNoun = (noun: string) => noun.replace(/\s*\([^)]*\)/g, '').trim();

const capitalise = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

const list = (items: string[]) => (items.length < 2 ? items.join('') : `${items.slice(0, -1).join(', ')} and ${items.at(-1)}`);

function composePrompt(request: ParsedRequest, v: ParsedVariant, ref: ImageRef): string {
  const room = request.room.label.toLowerCase();
  const sampleRef = (dataUrl: string) => ref(1 + v.samples.findIndex((s) => s.dataUrl === dataUrl));

  const changes = [
    ...v.changes.map((c) => selectionPrompt(c, c.sample ? sampleRef(c.sample) : undefined)),
    ...v.addons.map((a) => a.prompt),
  ];
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
