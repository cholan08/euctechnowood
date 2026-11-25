import { describe, expect, it } from 'vitest';
import { countVariant, emptyVariant, renumber } from './design';
import { describeOption } from './steps';

describe('countVariant', () => {
  it('counts changes only for parts this room has, plus extras', () => {
    const v = { ...emptyVariant(0), elements: { 'base-cabinets': { material: 'laminate' } }, notes: 'warm light' };
    const kitchen = countVariant(v, 'kitchen');
    expect(kitchen).toMatchObject({ cabinetry: 1, extras: 1, total: 2 });
    expect(kitchen.locked).toBeGreaterThan(0);
    // A bedroom has no base cabinets: only the note counts.
    expect(countVariant(v, 'bedroom')).toMatchObject({ cabinetry: 0, total: 1 });
  });
});

describe('renumber', () => {
  it('names options by position', () => {
    expect(renumber([emptyVariant(2), emptyVariant(0)]).map((v) => v.name)).toEqual(['Option A', 'Option B']);
  });
});

describe('describeOption', () => {
  it('lists the changed parts, or "Photoreal" for an untouched render', () => {
    const base = { id: '1', label: 'Option A', prompt: '', ms: 0 };
    expect(describeOption({ ...base, specs: [{ label: 'Base cabinets', value: 'Sage', hex: '#9AA98F' }, { label: 'Walls', value: 'White' }] })).toEqual({
      label: 'Option A',
      value: 'Base cabinets, Walls',
      hex: '#9AA98F',
    });
    expect(describeOption({ ...base, specs: [] }).value).toBe('Photoreal');
  });
});
