import type { Node, Mark } from '@tiptap/pm/model';
import { code } from './code';

describe('code exporter', () => {
  it('should export code annotation correctly', () => {
    const node = {
      textContent: 'const x = 1;',
    } as unknown as Node;

    const mark = {
      attrs: {
        uuid: 'code-uuid-1234',
      },
    } as unknown as Mark;

    const result = code({
      node,
      mark,
      parent: node,
      root: node,
      start: 0,
      passageUuid: 'passage-uuid-1234',
    });

    expect(result).toEqual({
      uuid: 'code-uuid-1234',
      passageUuid: 'passage-uuid-1234',
      type: 'code',
      start: 0,
      end: 12,
    });
  });

  it('should use parent textContent when node textContent is missing', () => {
    const parent = {
      textContent: 'function test()',
    } as unknown as Node;

    const node = {
      textContent: '',
    } as unknown as Node;

    const mark = {
      attrs: {
        uuid: 'code-uuid-5678',
      },
    } as unknown as Mark;

    const result = code({
      node,
      mark,
      parent,
      root: parent,
      start: 0,
      passageUuid: 'passage-uuid-1234',
    });

    expect(result).toEqual({
      uuid: 'code-uuid-5678',
      passageUuid: 'passage-uuid-1234',
      type: 'code',
      start: 0,
      end: 15,
    });
  });

  it('should return undefined when textContent is missing', () => {
    const node = {
      textContent: '',
    } as unknown as Node;

    const parent = {
      textContent: '',
    } as unknown as Node;

    const mark = {
      attrs: {
        uuid: 'code-uuid-empty',
      },
    } as unknown as Mark;

    const result = code({
      node,
      mark,
      parent,
      root: parent,
      start: 0,
      passageUuid: 'passage-uuid-1234',
    });

    expect(result).toBeUndefined();
  });
});
