import { parseTohList, serializeTohList } from '../toh';
import { baseAnnotationFromDTO, baseAnnotationToDto } from './annotation';
import type { AnnotationDTO } from './annotation-type';

describe('toh list helpers', () => {
  it('parses a comma-separated toh value into entries', () => {
    expect(parseTohList('toh417,toh418')).toEqual(['toh417', 'toh418']);
  });

  it('parses a single toh value into a one-element array', () => {
    expect(parseTohList('toh417')).toEqual(['toh417']);
  });

  it('trims whitespace and drops empty entries', () => {
    expect(parseTohList('toh417, toh418, ')).toEqual(['toh417', 'toh418']);
  });

  it('returns an empty array for empty/undefined input', () => {
    expect(parseTohList(undefined)).toEqual([]);
    expect(parseTohList('')).toEqual([]);
    expect(parseTohList(null)).toEqual([]);
  });

  it('serializes entries back to a comma-separated string', () => {
    expect(serializeTohList(['toh417', 'toh418'])).toBe('toh417,toh418');
  });

  it('serializes empty/undefined to undefined', () => {
    expect(serializeTohList([])).toBeUndefined();
    expect(serializeTohList(undefined)).toBeUndefined();
  });
});

describe('baseAnnotation toh round-trip', () => {
  const dto: AnnotationDTO = {
    uuid: 'a',
    start: 0,
    end: 5,
    type: 'glossary-instance',
    passage_uuid: 'p',
    toh: 'toh417,toh418',
    content: [],
  };

  it('parses the DB comma-string into an array on the domain type', () => {
    expect(baseAnnotationFromDTO(dto).toh).toEqual(['toh417', 'toh418']);
  });

  it('round-trips the toh list back to the DB comma-string', () => {
    const domain = baseAnnotationFromDTO(dto);
    expect(baseAnnotationToDto(domain).toh).toBe('toh417,toh418');
  });

  it('produces an empty array (and undefined DTO) when no toh is set', () => {
    const domain = baseAnnotationFromDTO({ ...dto, toh: undefined });
    expect(domain.toh).toEqual([]);
    expect(baseAnnotationToDto(domain).toh).toBeUndefined();
  });
});
