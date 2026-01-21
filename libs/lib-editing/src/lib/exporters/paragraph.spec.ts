import type { Node } from '@tiptap/pm/model';
import { paragraph } from './paragraph';

describe('paragraph exporter', () => {
  it('should export paragraph annotation correctly', () => {
    const parent = {
      attrs: {
        uuid: 'parent-uuid-5678',
      },
    } as unknown as Node;

    const node = {
      attrs: {
        uuid: 'paragraph-uuid-1234',
      },
      textContent: 'This is a paragraph of text.',
    } as unknown as Node;

    const result = paragraph({
      node,
      parent,
      root: parent,
      start: 0,
      passageUuid: 'passage-uuid-1234',
    });

    expect(result).toEqual({
      uuid: 'paragraph-uuid-1234',
      passageUuid: 'passage-uuid-1234',
      type: 'paragraph',
      start: 0,
      end: 28,
    });
  });

  it('should return undefined when paragraph uuid matches parent uuid', () => {
    const parent = {
      attrs: {
        uuid: 'same-uuid-1234',
      },
    } as unknown as Node;

    const node = {
      attrs: {
        uuid: 'same-uuid-1234',
      },
      textContent: 'This is a paragraph.',
    } as unknown as Node;

    const result = paragraph({
      node,
      parent,
      root: parent,
      start: 0,
      passageUuid: 'passage-uuid-1234',
    });

    expect(result).toBeUndefined();
  });

  it('should return undefined when textContent is empty', () => {
    const parent = {
      attrs: {
        uuid: 'parent-uuid-5678',
      },
    } as unknown as Node;

    const node = {
      attrs: {
        uuid: 'paragraph-uuid-empty',
      },
      textContent: '',
    } as unknown as Node;

    const result = paragraph({
      node,
      parent,
      root: parent,
      start: 0,
      passageUuid: 'passage-uuid-1234',
    });

    expect(result).toBeUndefined();
  });
});
