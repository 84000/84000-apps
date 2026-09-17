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

  it('should return undefined when the line has no children at all', () => {
    const node = {
      attrs: {
        uuid: 'line-uuid-empty',
      },
      textContent: '',
      childCount: 0,
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

  it('should export a zero-length annotation for a line holding only atoms', () => {
    // A folio reference on its own line: no characters, but still a break.
    const node = {
      attrs: {
        uuid: 'line-uuid-folio',
      },
      textContent: '',
      childCount: 1,
    } as unknown as Node;

    const result = line({
      node,
      parent: node,
      root: node,
      start: 12,
      passageUuid: 'passage-uuid-1234',
    });

    expect(result).toEqual({
      uuid: 'line-uuid-folio',
      passageUuid: 'passage-uuid-1234',
      type: 'line',
      start: 12,
      end: 12,
    });
  });
});
