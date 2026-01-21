import type { Node } from '@tiptap/pm/model';
import { line } from './line';

describe('line exporter', () => {
  it('should export line annotation correctly', () => {
    const node = {
      attrs: {
        uuid: 'line-uuid-1234',
      },
      textContent: 'This is a line of verse.',
    } as unknown as Node;

    const result = line({
      node,
      parent: node,
      root: node,
      start: 0,
      passageUuid: 'passage-uuid-1234',
    });

    expect(result).toEqual({
      uuid: 'line-uuid-1234',
      passageUuid: 'passage-uuid-1234',
      type: 'line',
      start: 0,
      end: 24,
    });
  });

  it('should return undefined when textContent is empty', () => {
    const node = {
      attrs: {
        uuid: 'line-uuid-empty',
      },
      textContent: '',
    } as unknown as Node;

    const result = line({
      node,
      parent: node,
      root: node,
      start: 0,
      passageUuid: 'passage-uuid-1234',
    });

    expect(result).toBeUndefined();
  });
});
