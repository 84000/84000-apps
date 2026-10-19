import { derivedUuidAllocator } from './derived-uuids';

describe('derivedUuidAllocator', () => {
  const uuidFor = (key: string) => (occurrence: number) =>
    `${key}#${occurrence}`;

  it('hands out successive occurrences of a key', () => {
    const allocate = derivedUuidAllocator();
    expect(allocate('a', uuidFor('a'))).toBe('a#1');
    expect(allocate('a', uuidFor('a'))).toBe('a#2');
    expect(allocate('b', uuidFor('b'))).toBe('b#1');
  });

  it('skips an occurrence that was taken', () => {
    const allocate = derivedUuidAllocator(['a#1', 'a#3']);
    expect(allocate('a', uuidFor('a'))).toBe('a#2');
    expect(allocate('a', uuidFor('a'))).toBe('a#4');
  });
});
