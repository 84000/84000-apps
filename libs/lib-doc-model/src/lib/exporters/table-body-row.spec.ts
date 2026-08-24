import type { Node } from '@tiptap/pm/model';
import { tableBodyRow } from './table-body-row';

describe('tableBodyRow exporter', () => {
  it('should export tableBodyRow annotation correctly', () => {
    const node = {
      attrs: {
        uuid: 'table-row-uuid-1234',
      },
      textContent: 'Cell 1\tCell 2\tCell 3',
    } as unknown as Node;

    const result = tableBodyRow({
      node,
      parent: node,
      root: node,
      start: 0,
      passageUuid: 'passage-uuid-1234',
    });

    expect(result).toEqual({
      uuid: 'table-row-uuid-1234',
      passageUuid: 'passage-uuid-1234',
      type: 'tableBodyRow',
      start: 0,
      end: 20,
    });
  });

  it('should return undefined when textContent is empty', () => {
    const node = {
      attrs: {
        uuid: 'table-row-uuid-empty',
      },
      textContent: '',
    } as unknown as Node;

    const result = tableBodyRow({
      node,
      parent: node,
      root: node,
      start: 0,
      passageUuid: 'passage-uuid-1234',
    });

    expect(result).toBeUndefined();
  });
});
