import type { Node } from '@tiptap/pm/model';
import { trailer } from './trailer';

describe('trailer exporter', () => {
  it('should export trailer annotation correctly', () => {
    const node = {
      attrs: {
        uuid: 'trailer-uuid-1234',
      },
      textContent: 'This concludes the chapter.',
    } as unknown as Node;

    const result = trailer({
      node,
      parent: node,
      root: node,
      start: 100,
      passageUuid: 'passage-uuid-1234',
    });

    expect(result).toEqual({
      uuid: 'trailer-uuid-1234',
      passageUuid: 'passage-uuid-1234',
      type: 'trailer',
      start: 100,
      end: 127,
    });
  });

  it('should return undefined when textContent is missing', () => {
    const node = {
      attrs: {
        uuid: 'trailer-uuid-empty',
      },
      textContent: '',
    } as unknown as Node;

    const result = trailer({
      node,
      parent: node,
      root: node,
      start: 0,
      passageUuid: 'passage-uuid-1234',
    });

    expect(result).toBeUndefined();
  });
});
