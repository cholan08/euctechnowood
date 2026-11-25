import { ADDONS, MOODS, appliesTo, elementsFor, type ElementGroup, type RoomTypeId } from '@shared/catalog';
import type { DesignSpec, RedesignRequest } from '@shared/types';

/** Everything the Standard panel edits. The image and room type come from the page. */
export type DesignState = Pick<RedesignRequest, 'source' | 'variants'>;

export const letter = (i: number) => String.fromCharCode(65 + i);

export const emptyVariant = (i: number): DesignSpec => ({ name: `Option ${letter(i)}`, elements: {}, addons: [], mood: '', notes: '' });

export const EMPTY_DESIGN: DesignState = { source: 'photo', variants: [emptyVariant(0)] };

/** Names always follow position, so removing B turns C into the new B. */
export const renumber = (variants: DesignSpec[]) => variants.map((v, i) => ({ ...v, name: `Option ${letter(i)}` }));

export interface VariantCount {
  cabinetry: number;
  surfaces: number;
  extras: number;
  total: number;
  /** Parts of this room that stay exactly as in the image. */
  locked: number;
}

/** What one option changes, counted only for parts that exist in this room type. */
export function countVariant(v: DesignSpec, room: RoomTypeId): VariantCount {
  const elements = elementsFor(room);
  const changed = elements.filter((e) => v.elements[e.id]);
  const byGroup = (g: ElementGroup) => changed.filter((e) => e.group === g).length;
  const extras =
    ADDONS.filter((a) => v.addons.includes(a.id) && appliesTo(a, room)).length +
    (MOODS.some((m) => m.id && m.id === v.mood) ? 1 : 0) +
    (v.notes.trim() ? 1 : 0);
  return {
    cabinetry: byGroup('cabinetry'),
    surfaces: byGroup('surfaces'),
    extras,
    total: changed.length + extras,
    locked: elements.length - changed.length,
  };
}
