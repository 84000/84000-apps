import type { Node } from '@tiptap/pm/model';
import { blockquote } from './blockquote';

describe('blockquote exporter', () => {
  it('should export blockquote annotation correctly', () => {
    const node = {
      attrs: {
        uuid: 'blockquote-uuid-1234',
      },
      textContent: 'This is a quoted passage from another text.',
    } as unknown as Node;

    const result = blockquote({
      node,
      parent: node,
      root: node,
      start: 0,
      passageUuid: 'passage-uuid-1234',
    });

    expect(result).toEqual({
      uuid: 'blockquote-uuid-1234',
      passageUuid: 'passage-uuid-1234',
      type: 'blockquote',
      start: 0,
      end: 43,
    });
  });

  it('should return undefined when textContent is missing', () => {
    const node = {
      attrs: {
        uuid: 'blockquote-uuid-empty',
      },
      textContent: '',
    } as unknown as Node;

    const result = blockquote({
      node,
      parent: node,
      root: node,
      start: 0,
      passageUuid: 'passage-uuid-1234',
    });

    expect(result).toBeUndefined();
  });
});
