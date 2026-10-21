import { folioLabel, parseFolioLabel } from './folio';

describe('folio labels', () => {
  it('writes 84000-style labels', () => {
    expect(folioLabel(12, 'a')).toBe('F.12.a');
    expect(folioLabel(3, 'xb')).toBe('F.3.xb');
  });

  it('writes nothing for a missing folio or side', () => {
    expect(folioLabel(null, 'a')).toBe('');
    expect(folioLabel(12, '')).toBe('');
  });

  it('parses what it writes, and nothing else', () => {
    expect(parseFolioLabel('F.12.a')).toEqual({ folio: 12, side: 'a' });
    expect(parseFolioLabel(' F.3.xb ')).toEqual({ folio: 3, side: 'xb' });
    expect(parseFolioLabel('12a')).toBeNull();
    expect(parseFolioLabel('F.12')).toBeNull();
  });
});
