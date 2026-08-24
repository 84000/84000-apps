import type { Node } from '@tiptap/pm/model';
import { listItem } from './list-item';

describe('listItem exporter', () => {
  it('should export listItem annotation correctly', () => {
    const node = {
      attrs: {
        uuid: 'listitem-uuid-1234',
      },
      textContent: 'This is a list item',
    } as unknown as Node;

    const result = listItem({
      node,
      parent: node,
      root: node,
      start: 0,
      passageUuid: 'passage-uuid-1234',
    });

    expect(result).toEqual({
      uuid: 'listitem-uuid-1234',
      passageUuid: 'passage-uuid-1234',
      type: 'listItem',
      start: 0,
      end: 19,
    });
  });

  it('should return undefined when textContent is empty', () => {
    const node = {
      attrs: {
        uuid: 'listitem-uuid-empty',
      },
      textContent: '',
    } as unknown as Node;

    const result = listItem({
      node,
      parent: node,
      root: node,
      start: 0,
      passageUuid: 'passage-uuid-1234',
    });

    expect(result).toBeUndefined();
  });
});
