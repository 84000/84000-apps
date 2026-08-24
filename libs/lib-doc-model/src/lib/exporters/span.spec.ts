import type { Node, Mark } from '@tiptap/pm/model';
import { span } from './span';

describe('span exporter', () => {
  it('should export bold span annotation correctly', () => {
    const node = {
      textContent: 'bold text',
    } as unknown as Node;

    const mark = {
      type: { name: 'bold' },
      attrs: {
        uuid: 'span-uuid-1234',
      },
    } as unknown as Mark;

    const result = span({
      node,
      mark,
      parent: node,
      root: node,
      start: 0,
      passageUuid: 'passage-uuid-1234',
    });

    expect(result).toEqual({
      uuid: 'span-uuid-1234',
      passageUuid: 'passage-uuid-1234',
      type: 'span',
      start: 0,
      end: 9,
      textStyle: 'text-bold',
      lang: undefined,
    });
  });

  it('should export smallCaps span annotation correctly', () => {
    const node = {
      textContent: 'small caps',
    } as unknown as Node;

    const mark = {
      type: { name: 'smallCaps' },
      attrs: {
        uuid: 'span-uuid-5678',
      },
    } as unknown as Mark;

    const result = span({
      node,
      mark,
      parent: node,
      root: node,
      start: 5,
      passageUuid: 'passage-uuid-1234',
    });

    expect(result).toEqual({
      uuid: 'span-uuid-5678',
      passageUuid: 'passage-uuid-1234',
      type: 'span',
      start: 5,
      end: 15,
      textStyle: 'small-caps',
      lang: undefined,
    });
  });

  it('should export span with language', () => {
    const node = {
      textContent: 'text',
    } as unknown as Node;

    const mark = {
      type: { name: 'bold' },
      attrs: {
        uuid: 'span-uuid-lang',
        lang: 'bo',
      },
    } as unknown as Mark;

    const result = span({
      node,
      mark,
      parent: node,
      root: node,
      start: 0,
      passageUuid: 'passage-uuid-1234',
    });

    expect(result).toEqual({
      uuid: 'span-uuid-lang',
      passageUuid: 'passage-uuid-1234',
      type: 'span',
      start: 0,
      end: 4,
      textStyle: 'text-bold',
      lang: 'bo',
    });
  });

  it('should return undefined when mark is missing', () => {
    const node = {
      textContent: 'text',
    } as unknown as Node;

    const result = span({
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
