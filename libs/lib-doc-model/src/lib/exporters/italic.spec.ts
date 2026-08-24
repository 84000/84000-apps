import type { Node, Mark } from '@tiptap/pm/model';
import { italic } from './italic';

describe('italic exporter', () => {
  it('should export inlineTitle annotation correctly', () => {
    const node = {
      textContent: 'Inline Title',
    } as unknown as Node;

    const mark = {
      attrs: {
        uuid: 'italic-uuid-1234',
        type: 'inlineTitle',
        lang: 'en',
      },
    } as unknown as Mark;

    const result = italic({
      node,
      mark,
      parent: node,
      root: node,
      start: 0,
      passageUuid: 'passage-uuid-1234',
    });

    expect(result).toEqual({
      uuid: 'italic-uuid-1234',
      passageUuid: 'passage-uuid-1234',
      type: 'inlineTitle',
      start: 0,
      end: 12,
      lang: 'en',
    });
  });

  it('should export span annotation with emphasis by default', () => {
    const node = {
      textContent: 'emphasized text',
    } as unknown as Node;

    const mark = {
      attrs: {
        uuid: 'italic-uuid-5678',
        type: 'span',
      },
    } as unknown as Mark;

    const result = italic({
      node,
      mark,
      parent: node,
      root: node,
      start: 5,
      passageUuid: 'passage-uuid-1234',
    });

    expect(result).toEqual({
      uuid: 'italic-uuid-5678',
      passageUuid: 'passage-uuid-1234',
      type: 'span',
      start: 5,
      end: 20,
      textStyle: 'emphasis',
    });
  });

  it('should return undefined when mark is missing', () => {
    const node = {
      textContent: 'text',
    } as unknown as Node;

    const result = italic({
      node,
      mark: undefined,
      parent: node,
      root: node,
      start: 0,
      passageUuid: 'passage-uuid-1234',
    });

    expect(result).toBeUndefined();
  });
});
