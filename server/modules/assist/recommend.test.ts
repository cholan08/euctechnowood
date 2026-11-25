import { describe, expect, it } from 'vitest';
import { parseFurniture, parseRecommendRequest, recommendMessage } from './recommend';

describe('furniture recommendations', () => {
  it('reads the JSON answer, trims it and drops duplicates and junk', () => {
    const raw = 'Sure! {"items": [{"name": "  Three-seater sofa ", "note": "Emerald velvet, brass legs"}, {"name": "three-seater sofa"}, {"name": 4}, {"name": "Rug", "note": 7}, {"name": "x"}]}';
    expect(parseFurniture(raw)).toEqual([
      { name: 'Three-seater sofa', note: 'Emerald velvet, brass legs' },
      { name: 'Rug', note: '' },
    ]);
  });

  it('returns nothing for an answer without JSON', () => {
    expect(parseFurniture('I cannot help with that.')).toEqual([]);
    expect(parseFurniture('{not json')).toEqual([]);
  });

  it('puts the style, colours, usual pieces and brief in the message', () => {
    const input = parseRecommendRequest({ roomType: 'bedroom', style: 'indian', palette: 'teak-brass', brief: 'konjam storage venum' });
    const msg = recommendMessage(input);
    expect(msg).toContain('Style: Contemporary Indian');
    expect(msg).toContain('Colour combination: Teak & brass');
    expect(msg).toContain('Queen bed with an upholstered headboard');
    expect(msg).toContain('"konjam storage venum". Follow it first.');
  });

  it('refuses an unknown style', () => {
    expect(() => parseRecommendRequest({ roomType: 'bedroom', style: 'japandi' })).toThrow('Choose a design style.');
  });
});
