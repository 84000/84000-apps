import type { Node } from '@tiptap/pm/model';
import { tableBodyHeader } from './table-body-header';

describe('tableBodyHeader exporter', () => {
  it('should export tableBodyHeader annotation correctly', () => {
    const node = {
      attrs: {
        uuid: 'table-header-uuid-1234',
      },
      textContent: 'Header Cell',
    } as unknown as Node;

    const result = tableBodyHeader({
      node,
      parent: node,
      root: node,
      start: 0,
      passageUuid: 'passage-uuid-1234',
    });

    expect(result).toEqual({
      uuid: 'table-header-uuid-1234',
      passageUuid: 'passage-uuid-1234',
      type: 'tableBodyHeader',
      start: 0,
      end: 11,
    });
  });

  it('should return undefined when textContent is empty', () => {
    const node = {
      attrs: {
        uuid: 'table-header-uuid-empty',
      },
      textContent: '',
    } as unknown as Node;

    const result = tableBodyHeader({
      node,
      parent: node,
      root: node,
      start: 0,
      passageUuid: 'passage-uuid-1234',
    });

    expect(result).toBeUndefined();
  });
});
