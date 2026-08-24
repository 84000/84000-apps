import type { Node } from '@tiptap/pm/model';
import { indent } from './indent';

describe('indent exporter', () => {
  it('should export indent annotation correctly', () => {
    const node = {
      attrs: {
        indentUuid: 'indent-uuid-1234',
      },
      textContent: 'Indented text',
    } as unknown as Node;

    const result = indent({
      node,
      parent: node,
      root: node,
      start: 0,
      passageUuid: 'passage-uuid-1234',
    });

    expect(result).toEqual({
      uuid: 'indent-uuid-1234',
      passageUuid: 'passage-uuid-1234',
      type: 'indent',
      start: 0,
      end: 13,
    });
  });

  it('should use parent textContent when node textContent is missing', () => {
    const parent = {
      textContent: 'Parent text',
    } as unknown as Node;

    const node = {
      attrs: {
        indentUuid: 'indent-uuid-5678',
      },
      textContent: '',
    } as unknown as Node;

    const result = indent({
      node,
      parent,
      root: parent,
      start: 5,
      passageUuid: 'passage-uuid-1234',
    });

    expect(result).toEqual({
      uuid: 'indent-uuid-5678',
      passageUuid: 'passage-uuid-1234',
      type: 'indent',
      start: 5,
      end: 16,
    });
  });
});
