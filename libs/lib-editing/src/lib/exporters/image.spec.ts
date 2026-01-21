import type { Node } from '@tiptap/pm/model';
import { image } from './image';

describe('image exporter', () => {
  it('should export image annotation correctly', () => {
    const node = {
      attrs: {
        uuid: 'image-uuid-1234',
        src: '/images/thangka.jpg',
      },
    } as unknown as Node;

    const result = image({
      node,
      parent: node,
      root: node,
      start: 100,
      passageUuid: 'passage-uuid-1234',
    });

    expect(result).toEqual({
      uuid: 'image-uuid-1234',
      passageUuid: 'passage-uuid-1234',
      type: 'image',
      start: 100,
      end: 100,
      src: '/images/thangka.jpg',
    });
  });

  it('should return undefined when src is missing', () => {
    const node = {
      attrs: {
        uuid: 'image-uuid-nosrc',
      },
    } as unknown as Node;

    const result = image({
      node,
      parent: node,
      root: node,
      start: 0,
      passageUuid: 'passage-uuid-1234',
    });

    expect(result).toBeUndefined();
  });
});
