import type { Node, Mark } from '@tiptap/pm/model';
import { quote } from './quote';

describe('quote exporter', () => {
  it('should export quote annotation correctly', () => {
    const node = {
      textContent: 'quoted text',
    } as unknown as Node;

    const mark = {
      attrs: {
        uuid: 'quote-uuid-1234',
      },
    } as unknown as Mark;

    const result = quote({
      node,
      mark,
      parent: node,
      root: node,
      start: 0,
      passageUuid: 'passage-uuid-1234',
    });

    expect(result).toEqual({
      uuid: 'quote-uuid-1234',
      passageUuid: 'passage-uuid-1234',
      type: 'quote',
      start: 0,
      end: 11,
    });
  });

  it('should return undefined when textContent is empty', () => {
    const node = {
      textContent: '',
    } as unknown as Node;

    const mark = {
      attrs: {
        uuid: 'quote-uuid-empty',
      },
    } as unknown as Mark;

    const result = quote({
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
