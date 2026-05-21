import type { Mark, Node } from '@tiptap/pm/model';
import { mantra } from './mantra';

describe('mantra exporter', () => {
  it('should export mantra annotation correctly', () => {
    const node = {
      attrs: {},
      textContent: 'oṃ maṇi padme hūṃ',
    } as unknown as Node;

    const mark = {
      attrs: {
        uuid: 'mantra-uuid-1234',
        lang: 'sa-Latn',
      },
    } as unknown as Mark;

    const result = mantra({
      mark,
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
      attrs: {},
      textContent: '',
    } as unknown as Node;

    const mark = {
      attrs: {
        uuid: 'mantra-uuid-empty',
        lang: 'sa-Latn',
      },
    } as unknown as Mark;

    const result = mantra({
      mark,
      node,
      parent: node,
      root: node,
      start: 0,
      passageUuid: 'passage-uuid-1234',
    });

    expect(result).toBeUndefined();
  });
});
