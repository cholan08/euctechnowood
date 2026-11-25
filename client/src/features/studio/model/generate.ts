import type { RoomTypeId } from '@shared/catalog';
import { DESIGN_STYLES, MAX_CONCEPTS, findPalette, styleSelections, type DesignStyle } from '@shared/styles';
import type { ConceptSpec, GenerateRequest } from '@shared/types';

/** Everything the Generate panel edits. The image and room type come from the page. */
export type GenerateState = Pick<GenerateRequest, 'style' | 'concepts' | 'furniture' | 'brief' | 'mood'>;

/** A concept filled from one of the style's colour combinations. */
export function conceptFrom(style: DesignStyle, paletteId: string, room: RoomTypeId, index: number): ConceptSpec {
  const palette = findPalette(style, paletteId);
  return { name: `Concept ${index + 1}`, palette: palette.id, elements: styleSelections(palette, room) };
}

/** A style's starting point: its first two combinations as two concepts. */
export function startGenerate(styleId: string, room: RoomTypeId, keep?: Pick<GenerateState, 'furniture' | 'brief' | 'mood'>): GenerateState {
  const style = DESIGN_STYLES.find((s) => s.id === styleId) ?? DESIGN_STYLES[0];
  const concepts = style.palettes.slice(0, 2).map((p, i) => conceptFrom(style, p.id, room, i));
  return { style: style.id, concepts, furniture: keep?.furniture ?? [], brief: keep?.brief ?? '', mood: keep?.mood ?? '' };
}

export const EMPTY_GENERATE: GenerateState = startGenerate(DESIGN_STYLES[0].id, 'living');

/** Concepts are named by position, so removing one renumbers the rest. */
export const renumberConcepts = (concepts: ConceptSpec[]) => concepts.map((c, i) => ({ ...c, name: `Concept ${i + 1}` }));

export { MAX_CONCEPTS };
