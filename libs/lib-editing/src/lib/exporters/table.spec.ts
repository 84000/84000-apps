import type { Node } from '@tiptap/pm/model';
import { table } from './table';

describe('table exporter', () => {
  it('should export table annotation correctly', () => {
    const node = {
      attrs: {
        uuid: 'table-uuid-1234',
      },
      textContent: 'Cell 1\tCell 2\nCell 3\tCell 4',
    } as unknown as Node;

    const result = table({
      node,
      parent: node,
      root: node,
      start: 0,
      passageUuid: 'passage-uuid-1234',
    });

    expect(result).toEqual({
      uuid: 'table-uuid-1234',
      passageUuid: 'passage-uuid-1234',
      type: 'table',
      start: 0,
      end: 27,
    });
  });

  it('should return undefined when textContent is empty', () => {
    const node = {
      attrs: {
        uuid: 'table-uuid-empty',
      },
      textContent: '',
    } as unknown as Node;

    const result = table({
      node,
      parent: node,
      root: node,
      start: 0,
      passageUuid: 'passage-uuid-1234',
    });

    expect(result).toBeUndefined();
  });
});
