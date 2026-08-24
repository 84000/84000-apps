import type { Node } from '@tiptap/pm/model';
import { leadingSpace } from './leading-space';

describe('leadingSpace exporter', () => {
  it('should export leadingSpace annotation correctly', () => {
    const node = {
      attrs: {
        leadingSpaceUuid: 'leading-space-uuid-1234',
      },
    } as unknown as Node;

    const result = leadingSpace({
      node,
      parent: node,
      root: node,
      start: 10,
      passageUuid: 'passage-uuid-1234',
    });

    expect(result).toEqual({
      uuid: 'leading-space-uuid-1234',
      passageUuid: 'passage-uuid-1234',
      type: 'leadingSpace',
      start: 10,
      end: 10,
    });
  });
});
