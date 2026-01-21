import type { Node } from '@tiptap/pm/model';
import { heading } from './heading';

describe('heading exporter', () => {
  it('should export heading annotation correctly', () => {
    const node = {
      attrs: {
        uuid: 'heading-uuid-1234',
        level: 2,
        class: 'chapter-title',
      },
      textContent: 'Chapter Title',
    } as unknown as Node;

    const result = heading({
      node,
      parent: node,
      root: node,
      start: 0,
      passageUuid: 'passage-uuid-1234',
    });

    expect(result).toEqual({
      uuid: 'heading-uuid-1234',
      passageUuid: 'passage-uuid-1234',
      type: 'heading',
      start: 0,
      end: 13,
      level: 2,
      class: 'chapter-title',
    });
  });

  it('should default to level 1 when level is missing', () => {
    const node = {
      attrs: {
        uuid: 'heading-uuid-5678',
      },
      textContent: 'Default Heading',
    } as unknown as Node;

    const result = heading({
      node,
      parent: node,
      root: node,
      start: 0,
      passageUuid: 'passage-uuid-1234',
    });

    expect(result).toEqual({
      uuid: 'heading-uuid-5678',
      passageUuid: 'passage-uuid-1234',
      type: 'heading',
      start: 0,
      end: 15,
      level: 1,
      class: undefined,
    });
  });

  it('should return undefined when textContent is missing', () => {
    const node = {
      attrs: {
        uuid: 'heading-uuid-empty',
        level: 1,
      },
      textContent: '',
    } as unknown as Node;

    const result = heading({
      node,
      parent: node,
      root: node,
      start: 0,
      passageUuid: 'passage-uuid-1234',
    });

    expect(result).toBeUndefined();
  });
});
