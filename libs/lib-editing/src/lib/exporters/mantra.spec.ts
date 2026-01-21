import type { Node } from '@tiptap/pm/model';
import { mantra } from './mantra';

describe('mantra exporter', () => {
  it('should export mantra annotation correctly', () => {
    const node = {
      attrs: {
        uuid: 'mantra-uuid-1234',
        lang: 'sa-Latn',
      },
      textContent: 'oṃ maṇi padme hūṃ',
    } as unknown as Node;

    const result = mantra({
      node,
      parent: node,
      root: node,
      start: 0,
      passageUuid: 'passage-uuid-1234',
    });

    expect(result).toEqual({
      uuid: 'mantra-uuid-1234',
      passageUuid: 'passage-uuid-1234',
      type: 'mantra',
      start: 0,
      end: 17,
      lang: 'sa-Latn',
    });
  });

  it('should return undefined when textContent is empty', () => {
    const node = {
      attrs: {
        uuid: 'mantra-uuid-empty',
        lang: 'sa-Latn',
      },
      textContent: '',
    } as unknown as Node;

    const result = mantra({
      node,
      parent: node,
      root: node,
      start: 0,
      passageUuid: 'passage-uuid-1234',
    });

    expect(result).toBeUndefined();
  });
});
