import type { Node, Mark } from '@tiptap/pm/model';
import { glossaryInstance } from './glossary-instance';

describe('glossaryInstance exporter', () => {
  it('should export glossaryInstance annotation correctly', () => {
    const node = {
      textContent: 'Buddha',
    } as unknown as Node;

    const mark = {
      attrs: {
        uuid: 'a1b2c3d4-5678-90ab-cdef-1234567890ab',
        glossary: 'f1e2d3c4-5678-90ab-cdef-fedcba098765',
      },
    } as unknown as Mark;

    const result = glossaryInstance({
      node,
      mark,
      parent: node,
      root: node,
      start: 5,
      passageUuid: 'passage-uuid-1234',
    });

    expect(result).toEqual({
      uuid: 'a1b2c3d4-5678-90ab-cdef-1234567890ab',
      passageUuid: 'passage-uuid-1234',
      type: 'glossaryInstance',
      start: 5,
      end: 11,
      glossary: 'f1e2d3c4-5678-90ab-cdef-fedcba098765',
    });
  });

  it('should return undefined when textContent is missing', () => {
    const node = {
      textContent: '',
    } as unknown as Node;

    const mark = {
      attrs: {
        uuid: 'a1b2c3d4-5678-90ab-cdef-1234567890ab',
        glossary: 'f1e2d3c4-5678-90ab-cdef-fedcba098765',
      },
    } as unknown as Mark;

    const result = glossaryInstance({
      node,
      mark,
      parent: node,
      root: node,
      start: 0,
      passageUuid: 'passage-uuid-1234',
    });

    expect(result).toBeUndefined();
  });

  it('should return undefined when glossary is missing', () => {
    const node = {
      textContent: 'Buddha',
    } as unknown as Node;

    const mark = {
      attrs: {
        uuid: 'a1b2c3d4-5678-90ab-cdef-1234567890ab',
      },
    } as unknown as Mark;

    const result = glossaryInstance({
      node,
      mark,
      parent: node,
      root: node,
      start: 0,
      passageUuid: 'passage-uuid-1234',
    });

    expect(result).toBeUndefined();
  });
});
