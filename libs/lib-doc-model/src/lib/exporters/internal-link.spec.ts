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

  it('exports a link that has only an href', () => {
    const node = { textContent: 'internal link' } as unknown as Node;
    const mark = {
      attrs: {
        uuid: 'internal-link-uuid-href',
        href: '/translation/toh1-17',
        linkStatus: 'not-found',
        label: '',
      },
    } as unknown as Mark;

    const result = internalLink({
      node,
      mark,
      parent: node,
      root: node,
      start: 2,
      passageUuid: 'passage-uuid-1234',
    });

    expect(result).toEqual({
      uuid: 'internal-link-uuid-href',
      passageUuid: 'passage-uuid-1234',
      type: 'internalLink',
      linkType: undefined,
      entity: undefined,
      href: '/translation/toh1-17',
      linkStatus: 'not-found',
      isPending: true,
      label: '',
      start: 2,
      end: 15,
    });
  });
});
