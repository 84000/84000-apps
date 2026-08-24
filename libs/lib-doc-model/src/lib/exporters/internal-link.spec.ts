import type { Node, Mark } from '@tiptap/pm/model';
import { internalLink } from './internal-link';

describe('internalLink exporter', () => {
  it('should export internalLink annotation correctly', () => {
    const node = {
      textContent: 'internal link',
    } as unknown as Node;

    const mark = {
      attrs: {
        uuid: 'internal-link-uuid-1234',
        type: 'passage',
        entity: 'entity-uuid-5678',
        href: '/passage/entity-uuid-5678',
        isPending: false,
      },
    } as unknown as Mark;

    const result = internalLink({
      node,
      mark,
      parent: node,
      root: node,
      start: 0,
      passageUuid: 'passage-uuid-1234',
    });

    expect(result).toEqual({
      uuid: 'internal-link-uuid-1234',
      passageUuid: 'passage-uuid-1234',
      type: 'internalLink',
      linkType: 'passage',
      entity: 'entity-uuid-5678',
      href: '/passage/entity-uuid-5678',
      isPending: false,
      start: 0,
      end: 13,
    });
  });

  it('should return undefined when textContent is missing', () => {
    const node = {
      textContent: '',
    } as unknown as Node;

    const mark = {
      attrs: {
        uuid: 'internal-link-uuid-empty',
        type: 'passage',
        entity: 'entity-uuid-5678',
      },
    } as unknown as Mark;

    const result = internalLink({
      node,
      mark,
      parent: node,
      root: node,
      start: 0,
      passageUuid: 'passage-uuid-1234',
    });

    expect(result).toBeUndefined();
  });

  it('should return undefined when entity is missing', () => {
    const node = {
      textContent: 'internal link',
    } as unknown as Node;

    const mark = {
      attrs: {
        uuid: 'internal-link-uuid-noentity',
        type: 'passage',
      },
    } as unknown as Mark;

    const result = internalLink({
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
