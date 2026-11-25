import { describe, expect, it } from 'vitest';
import { assistMessage, localSuggestions, parseSuggestions } from './assist.prompts';
import { parseAssistRequest } from './assist.schema';

describe('parseSuggestions', () => {
  it('reads the JSON answer, even with text around it', () => {
    expect(parseSuggestions('Sure! {"suggestions": ["Fluted grooves", "Gold edge", "Matte black handles"]} Hope it helps', 'change')).toEqual([
      'Fluted grooves',
      'Gold edge',
      'Matte black handles',
    ]);
  });

  it('falls back to one per line, stripping bullets and quotes, without duplicates', () => {
    expect(parseSuggestions('1. "Fluted grooves"\n- Fluted grooves\n* Gold edge\n• Brass handles\n• Extra', 'details')).toEqual(['Fluted grooves', 'Gold edge', 'Brass handles']);
  });

  it('drops junk', () => {
    expect(parseSuggestions('{"suggestions": [1, "ok", "{nested}"]}', 'note')).toEqual([]);
  });
});

describe('assistMessage', () => {
  it('quotes what staff typed and names the part', () => {
    const msg = assistMessage(parseAssistRequest({ kind: 'change', roomType: 'kitchen', part: 'base-cabinets', text: 'konjam "fluted" design venum' }));
    expect(msg).toContain('the base cabinets');
    expect(msg).toContain(`Staff wrote: "konjam 'fluted' design venum"`);
  });

  it('asks for ideas when the bar is empty', () => {
    expect(assistMessage(parseAssistRequest({ kind: 'note', roomType: 'bedroom' }))).toMatch(/Suggest 3 useful notes/);
  });
});

describe('localSuggestions (mock mode)', () => {
  it('builds on what was typed', () => {
    expect(localSuggestions(parseAssistRequest({ kind: 'change', roomType: 'kitchen', text: 'grey.' }))[0]).toBe('Grey');
  });

  it('suggests door details for parts with doors', () => {
    expect(localSuggestions(parseAssistRequest({ kind: 'details', roomType: 'kitchen', part: 'base-cabinets' }))[0]).toMatch(/fluted/);
  });

  it('ignores a part the room does not have', () => {
    expect(parseAssistRequest({ kind: 'details', roomType: 'bedroom', part: 'base-cabinets' }).element).toBeNull();
  });
});
