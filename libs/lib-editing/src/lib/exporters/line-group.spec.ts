import type { Node } from '@tiptap/pm/model';
import { lineGroup } from './line-group';

describe('lineGroup exporter', () => {
  it('should export lineGroup annotation correctly', () => {
    const node = {
      attrs: {
        uuid: 'linegroup-uuid-1234',
      },
      textContent: 'First line\nSecond line\nThird line',
    } as unknown as Node;

    const result = lineGroup({
      node,
      parent: node,
      root: node,
      start: 0,
      passageUuid: 'passage-uuid-1234',
    });

    expect(result).toEqual({
      uuid: 'linegroup-uuid-1234',
      passageUuid: 'passage-uuid-1234',
      type: 'lineGroup',
      start: 0,
      end: 33,
    });
  });

  it('should return undefined when textContent is empty', () => {
    const node = {
      attrs: {
        uuid: 'linegroup-uuid-empty',
      },
      textContent: '',
    } as unknown as Node;

    const result = lineGroup({
      node,
      parent: node,
      root: node,
      start: 0,
      passageUuid: 'passage-uuid-1234',
    });

    expect(result).toBeUndefined();
  });
});
