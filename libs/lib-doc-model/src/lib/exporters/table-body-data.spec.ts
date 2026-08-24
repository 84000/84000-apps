import type { Node } from '@tiptap/pm/model';
import { tableBodyData } from './table-body-data';

describe('tableBodyData exporter', () => {
  it('should export tableBodyData annotation correctly', () => {
    const node = {
      attrs: {
        uuid: 'table-data-uuid-1234',
      },
      textContent: 'Table cell content',
    } as unknown as Node;

    const result = tableBodyData({
      node,
      parent: node,
      root: node,
      start: 0,
      passageUuid: 'passage-uuid-1234',
    });

    expect(result).toEqual({
      uuid: 'table-data-uuid-1234',
      passageUuid: 'passage-uuid-1234',
      type: 'tableBodyData',
      start: 0,
      end: 18,
    });
  });

  it('should return undefined when textContent is empty', () => {
    const node = {
      attrs: {
        uuid: 'table-data-uuid-empty',
      },
      textContent: '',
    } as unknown as Node;

    const result = tableBodyData({
      node,
      parent: node,
      root: node,
      start: 0,
      passageUuid: 'passage-uuid-1234',
    });

    expect(result).toBeUndefined();
  });
});
