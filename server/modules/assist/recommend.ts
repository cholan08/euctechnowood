import { z } from 'zod';
import { NOTES_MAX, cleanText } from '@shared/catalog';
import { DESIGN_STYLES, FURNITURE, FURNITURE_NAME_MAX, findPalette, localFurniture, type DesignStyle, type FurnitureIdea, type StylePalette } from '@shared/styles';
import { findRoom, parseBody, roomTypeField, type Room } from '../../lib/validation';

// Furniture recommendations for Generate: what this room needs, in the chosen
// style and colours. With a text model it reads the brief (any language); without
// one it answers with the room's usual pieces in the style's look.

export interface ParsedRecommend {
  room: Room;
  style: DesignStyle;
  palette: StylePalette;
  brief: string;
}

const styleIds = DESIGN_STYLES.map((s) => s.id) as [string, ...string[]];

const recommendSchema = z.object({
  roomType: roomTypeField,
  style: z.enum(styleIds, { error: 'Choose a design style.' }),
  palette: z.string().max(40).optional(),
  brief: z.string().max(NOTES_MAX + 40, 'That brief is too long.').default(''),
});

export function parseRecommendRequest(body: unknown): ParsedRecommend {
  const b = parseBody(recommendSchema, body);
  const style = DESIGN_STYLES.find((s) => s.id === b.style)!;
  return { room: findRoom(b.roomType), style, palette: findPalette(style, b.palette), brief: cleanText(b.brief, NOTES_MAX) };
}

export const RECOMMEND_SYSTEM = `You are an interior designer at EUC Technowood, a modular furniture maker in India, recommending furniture for a room that will be shown to a customer as an AI-generated concept.
Staff may write the brief in English, Tamil, Hindi or Tanglish. Always answer in clear, simple English.
Answer with JSON only, no other text: {"items": [{"name": "...", "note": "..."}]} with 6 to 8 items.
"name": the piece, at most 8 words (for example "Three-seater sofa with low arms"). "note": how it should look in this style and colour combination (material, colour, shape), at most 18 words.
Recommend only furniture, lighting, rugs, curtains and decor that fit an Indian home of this room type. Never suggest new walls, windows or doors, and no brand names.`;

export function recommendMessage({ room, style, palette, brief }: ParsedRecommend): string {
  return [
    `Room: ${room.label.toLowerCase()}. Style: ${style.label} (${style.prompt}). Colour combination: ${palette.label}. Furniture look: ${style.furnitureLook}.`,
    `Typical pieces for this room: ${FURNITURE[room.id].join('; ')}.`,
    brief ? `The designer's brief: "${brief.replace(/"/g, "'")}". Follow it first.` : 'No brief: recommend what this room usually needs.',
  ].join('\n');
}

/** Reads the model's answer; anything unusable is dropped. */
export function parseFurniture(raw: string): FurnitureIdea[] {
  const json = raw.match(/\{[\s\S]*\}/)?.[0];
  if (!json) return [];
  try {
    const parsed = JSON.parse(json) as { items?: unknown };
    if (!Array.isArray(parsed.items)) return [];
    const items = parsed.items
      .filter((i): i is { name: string; note?: unknown } => Boolean(i) && typeof (i as { name?: unknown }).name === 'string')
      .map((i) => ({ name: cleanText(i.name, FURNITURE_NAME_MAX), note: typeof i.note === 'string' ? cleanText(i.note, 200) : '' }))
      .filter((i) => i.name.length > 2);
    const seen = new Set<string>();
    return items.filter((i) => !seen.has(i.name.toLowerCase()) && seen.add(i.name.toLowerCase())).slice(0, 10);
  } catch {
    return [];
  }
}

export const localRecommendations = (input: ParsedRecommend) => localFurniture(input.room.id);
