import type { Node } from '@tiptap/pm/model';
import { list } from './list';

describe('list exporter', () => {
  it('should export list annotation correctly', () => {
    const node = {
      attrs: {
        uuid: 'list-uuid-1234',
        spacing: 'compact',
        nesting: 0,
        itemStyle: 'bullet',
      },
      textContent: 'Item 1\nItem 2\nItem 3',
    } as unknown as Node;

    const result = list({
      node,
      parent: node,
      root: node,
      start: 0,
      passageUuid: 'passage-uuid-1234',
    });

    expect(result).toEqual({
      uuid: 'list-uuid-1234',
      passageUuid: 'passage-uuid-1234',
      type: 'list',
      start: 0,
      end: 20,
      spacing: 'compact',
      nesting: 0,
      itemStyle: 'bullet',
    });
  });

  it('should default nesting to 0 when missing', () => {
    const node = {
      attrs: {
        uuid: 'list-uuid-5678',
      },
      textContent: 'Item 1',
    } as unknown as Node;

    const result = list({
      node,
      parent: node,
      root: node,
      start: 0,
      passageUuid: 'passage-uuid-1234',
    });

    expect(result).toEqual({
      uuid: 'list-uuid-5678',
      passageUuid: 'passage-uuid-1234',
      type: 'list',
      start: 0,
      end: 6,
      spacing: undefined,
      nesting: 0,
      itemStyle: undefined,
    });
  });

  it('should return undefined when textContent is empty', () => {
    const node = {
      attrs: {
        uuid: 'list-uuid-empty',
      },
      textContent: '',
    } as unknown as Node;

    const result = list({
      node,
      parent: node,
      root: node,
      start: 0,
      passageUuid: 'passage-uuid-1234',
    });

    expect(result).toBeUndefined();
  });
});
