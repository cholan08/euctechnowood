import { INSTRUCTION_MAX, NOTES_MAX, cleanText, finishPrompt } from '@shared/catalog';
import type { ParsedAssist } from './assist.schema';

// "AI help" for the prompt bars. Staff type a few rough words, often in Tamil,
// Hindi or Tanglish; a text model turns them into three short, clear English
// instructions that the image AI follows well. Staff pick one (or keep editing),
// and only the text they keep goes into the image prompt.

const SYSTEM = `You help the design staff of EUC Technowood, a modular kitchen and wardrobe maker in India, write short instructions for an AI photo editor that changes a customer's room photo.
Staff may write in English, Tamil, Hindi or a mix such as Tanglish, with typos. Always answer in clear, simple English.
Answer with JSON only, no other text: {"suggestions": ["...", "...", "..."]} with exactly 3 suggestions.
Describe only how things should look: material, colour, pattern, texture, grain direction, groove or panel spacing, edges, handles, sheen, light.
Never move, resize, add or remove furniture, walls, windows, doors or appliances unless staff clearly ask for it. No people, text, logos, or brand names staff did not write. Keep any measurements staff gave; do not invent new ones.`;

const quote = (s: string) => `"${s.replace(/"/g, "'")}"`;

/** The user message: what the bar is about, then what staff typed (or a request for ideas). */
export function assistMessage(input: ParsedAssist): string {
  const { kind, room, element, finish, text } = input;
  const roomName = room.label.toLowerCase();
  const part = element ? `${element.label.toLowerCase()} (${element.noun})` : '';
  const finishWords = finish ? finishPrompt(finish) : '';

  if (kind === 'details') {
    return [
      `Room: ${roomName}. Part: ${part || 'one part of the room'}.${finishWords ? ` Its new finish: ${finishWords}.` : ''}`,
      text
        ? `Staff wrote these extra details: ${quote(text)}. Rewrite them as 3 clear options: the first closest to what they wrote, the next ones a little more specific.`
        : 'Staff have not written anything yet. Suggest 3 extra details that suit this finish (for example a groove pattern, an edge, a handle or a texture detail), from subtle to bold.',
      `Give only the extra details, not the finish itself. Each suggestion at most 20 words.`,
    ].join('\n');
  }

  if (kind === 'change') {
    return [
      `Room: ${roomName}. Staff marked ${part ? `the ${part}` : 'an area'} on the photo; only that area will change.`,
      text
        ? `Staff wrote: ${quote(text)}. Rewrite it as 3 clear instructions for the marked area: the first closest to what they wrote, the next ones a little more specific.`
        : `Suggest 3 popular changes for ${part ? `the ${element!.label.toLowerCase()}` : 'it'} in an Indian home, each a complete instruction.`,
      'Each suggestion at most 20 words.',
    ].join('\n');
  }

  return [
    `Room: ${roomName}. This is a designer's note that goes with a whole-room design; the finish of each part is already listed separately.`,
    text
      ? `Staff wrote: ${quote(text)}. Rewrite it as 3 clear notes for the AI: the first closest to what they wrote, the next ones a little more specific.`
      : 'Suggest 3 useful notes (for example light, a colour relationship between parts, or keeping surfaces clear).',
    'Each suggestion at most 35 words.',
  ].join('\n');
}

export const assistSystem = () => SYSTEM;

/** Reads the model's answer: JSON first, then one suggestion per line as a fallback. */
export function parseSuggestions(raw: string, kind: ParsedAssist['kind']): string[] {
  const max = kind === 'note' ? NOTES_MAX : INSTRUCTION_MAX;
  let items: unknown[] = [];
  const json = raw.match(/\{[\s\S]*\}/)?.[0];
  if (json) {
    try {
      const parsed = JSON.parse(json) as { suggestions?: unknown };
      if (Array.isArray(parsed.suggestions)) items = parsed.suggestions;
    } catch {
      // Not valid JSON: fall through to lines.
    }
  }
  if (!items.length) items = raw.split('\n').map((l) => l.replace(/^\s*(?:[-*•]|\d+[.)])\s*/, ''));
  const clean = items
    .filter((s): s is string => typeof s === 'string')
    .map((s) => cleanText(s.replace(/^["'“]+|["'”]+$/g, ''), max))
    .filter((s) => s.length > 2 && !/^[{[]/.test(s));
  return [...new Set(clean)].slice(0, 3);
}

const capitalise = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/** Mock mode (no AI key): simple built-in suggestions, so the UI can be tried without paying. */
export function localSuggestions({ kind, element, text }: ParsedAssist): string[] {
  if (text) {
    const t = capitalise(text.replace(/[.\s]+$/, ''));
    return [t, `${t}, neat and even across the whole part`, `${t}, with realistic texture and soft reflections`];
  }
  if (kind === 'note') return ['Make the hob wall a shade darker than the rest', 'Warm, inviting evening light from the existing fittings', 'Keep the countertops clear of clutter'];
  if (element?.doors) return ['Fine vertical fluted grooves on each shutter', 'Slim brushed-gold edge profile along the top of each shutter', 'Thin matte-black handle line on every drawer'];
  return ['Even, realistic texture across the whole surface', 'A slightly warmer tone, natural-looking', 'Clean, straight edges where it meets the walls'];
}
