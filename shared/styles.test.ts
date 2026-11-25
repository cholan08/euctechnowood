import { describe, expect, it } from 'vitest';
import { ELEMENTS, ROOM_TYPES, resolveSelection } from './catalog';
import { DESIGN_STYLES, FURNITURE, localFurniture, partFamily, styleSelections } from './styles';

describe('design styles', () => {
  it('every combination uses real catalogue materials, shades, finishes and shutter designs', () => {
    for (const style of DESIGN_STYLES) {
      for (const palette of style.palettes) {
        for (const room of ROOM_TYPES) {
          const sels = styleSelections(palette, room.id);
          for (const [id, sel] of Object.entries(sels)) {
            const element = ELEMENTS.find((e) => e.id === id)!;
            const r = resolveSelection(element, sel);
            const where = `${style.id}/${palette.id}/${room.id}/${id}`;
            expect(r, where).not.toBeNull();
            // resolveSelection drops unknown ids quietly; a typo would silently lose the colour.
            if (sel.shade) expect(r!.shade?.id, `${where} shade`).toBe(sel.shade);
            if (sel.finish) expect(r!.finish?.id, `${where} finish`).toBe(sel.finish);
            if (sel.profile) expect(r!.profile?.id, `${where} profile`).toBe(sel.profile);
          }
        }
      }
    }
  });

  it('fills the main parts of a kitchen, and only the parts asked for', () => {
    const modern = DESIGN_STYLES.find((s) => s.id === 'modern')!.palettes[0];
    const kitchen = styleSelections(modern, 'kitchen');
    expect(Object.keys(kitchen)).toEqual(expect.arrayContaining(['base-cabinets', 'wall-cabinets', 'countertop', 'backsplash', 'handles', 'walls', 'floor']));
    expect(kitchen['base-cabinets']).toEqual({ material: 'laminate', shade: 'graphite', finish: 'super-matte', profile: 'slab' });
    // Wall cabinets take the accent colour.
    expect(kitchen['wall-cabinets'].shade).toBe('light-oak');
    expect(Object.keys(styleSelections(modern, 'kitchen', new Set(['countertop'])))).toEqual(['countertop']);
  });

  it('gives each style at least two combinations with swatches', () => {
    for (const s of DESIGN_STYLES) {
      expect(s.palettes.length, s.id).toBeGreaterThanOrEqual(2);
      for (const p of s.palettes) for (const c of p.colours) expect(c).toMatch(/^#[0-9A-F]{6}$/i);
    }
  });

  it('maps every changeable part to a family and recommends furniture for every room', () => {
    for (const e of ELEMENTS) expect(partFamily(e.id), e.id).toBeDefined();
    for (const r of ROOM_TYPES) expect(FURNITURE[r.id].length).toBeGreaterThan(3);
    expect(localFurniture('bedroom')[0]).toEqual({ name: 'Queen bed with an upholstered headboard', note: '' });
  });
});
