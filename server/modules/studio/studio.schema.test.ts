import { describe, expect, it } from 'vitest';
import { RequestError } from '../../lib/errors';
import { parseEditRequest, parseFinalRequest, parseRedesignRequest } from './studio.schema';

const image = 'data:image/png;base64,iVBORw0KGgo=';
const area = { x: 0.1, y: 0.2, w: 0.3, h: 0.4 };
const base = { image, width: 1000, height: 750, roomType: 'kitchen' };

describe('parseEditRequest', () => {
  it('resolves a catalogue finish and splits the image', () => {
    const p = parseEditRequest({ ...base, part: 'base-cabinets', finish: { material: 'laminate', shade: 'sage' }, area });
    expect(p.image).toEqual({ mimeType: 'image/png', base64: 'iVBORw0KGgo=' });
    expect(p.element?.id).toBe('base-cabinets');
    expect(p.change?.shade?.id).toBe('sage');
    expect(p.text).toBe('');
  });

  it('accepts own words, tidying spaces', () => {
    const p = parseEditRequest({ ...base, text: '  light grey   with grooves ', area });
    expect(p.element).toBeNull();
    expect(p.text).toBe('light grey with grooves');
  });

  it('ignores an item photo sent with a catalogue finish', () => {
    const p = parseEditRequest({ ...base, part: 'base-cabinets', finish: { material: 'laminate' }, reference: image, area });
    expect(p.reference).toBeNull();
  });

  it.each([
    [{ ...base, image: 'http://x/y.jpg', text: 'x', area }, 'Upload a JPG, PNG or WebP image.'],
    [{ ...base, roomType: 'garage', text: 'x', area }, 'Choose a room type.'],
    [{ ...base, text: 'x' }, 'Mark the part on the photo first.'],
    [{ ...base, area }, 'Pick a change, describe it in your own words, or add an item photo.'],
    [{ ...base, roomType: 'bedroom', part: 'base-cabinets', text: 'x', area }, 'That part is not in a bedroom.'],
    [{ ...base, finish: { material: 'laminate' }, area }, 'Pick the part to change.'],
    [{ ...base, part: 'base-cabinets', finish: { material: 'unobtainium' }, area }, 'Pick the new finish.'],
  ])('refuses %# with a message staff can read', (body, message) => {
    expect(() => parseEditRequest(body)).toThrow(new RequestError(message));
  });
});

describe('parseRedesignRequest', () => {
  it('names options by position and locks every part not changed', () => {
    const p = parseRedesignRequest({ ...base, variants: [{ elements: { 'base-cabinets': { material: 'laminate' } } }] });
    expect(p.variants[0].name).toBe('Option A');
    expect(p.variants[0].changes.map((c) => c.element.id)).toEqual(['base-cabinets']);
    expect(p.variants[0].locked.some((e) => e.id === 'base-cabinets')).toBe(false);
    expect(p.variants[0].locked.length).toBeGreaterThan(3);
  });

  it('refuses a photo option with no changes, but accepts an empty render ("make it photoreal")', () => {
    expect(() => parseRedesignRequest({ ...base, variants: [{}] })).toThrow('Option A has no changes');
    expect(parseRedesignRequest({ ...base, source: 'render', variants: [{}] }).variants[0].changes).toEqual([]);
  });

  it('sends a sample used by several parts only once', () => {
    const sel = { material: 'laminate', shade: 'sage', sample: image };
    const p = parseRedesignRequest({ ...base, variants: [{ elements: { 'base-cabinets': sel, 'wall-cabinets': sel } }] });
    expect(p.variants[0].samples).toHaveLength(1);
  });
});

describe('parseFinalRequest', () => {
  it('needs only the image and room', () => {
    expect(parseFinalRequest(base).room.id).toBe('kitchen');
  });
});
