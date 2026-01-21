import type { Node, Mark } from '@tiptap/pm/model';
import { link } from './link';

describe('link exporter', () => {
  it('should export link annotation correctly', () => {
    const node = {
      textContent: 'link text',
    } as unknown as Node;

    const mark = {
      attrs: {
        uuid: 'link-uuid-1234',
        type: 'link',
        href: 'https://example.com',
        text: 'Example Link',
      },
      type: { name: 'link' },
    } as unknown as Mark;

    const result = link({
      node,
      mark,
      parent: node,
      root: node,
      start: 0,
      passageUuid: 'passage-uuid-1234',
    });

    expect(result).toEqual({
      uuid: 'link-uuid-1234',
      passageUuid: 'passage-uuid-1234',
      type: 'link',
      start: 0,
      end: 9,
      href: 'https://example.com',
      text: 'Example Link',
    });
  });

  it('should export reference annotation correctly', () => {
    const node = {
      textContent: 'reference text',
    } as unknown as Node;

    const mark = {
      attrs: {
        uuid: 'ref-uuid-5678',
        type: 'reference',
        href: '/passage/123',
      },
      type: { name: 'reference' },
    } as unknown as Mark;

    const result = link({
      node,
      mark,
      parent: node,
      root: node,
      start: 5,
      passageUuid: 'passage-uuid-1234',
    });

    expect(result).toEqual({
      uuid: 'ref-uuid-5678',
      passageUuid: 'passage-uuid-1234',
      type: 'reference',
      start: 5,
      end: 19,
      href: '/passage/123',
    });
  });

  it('should return undefined when href is missing', () => {
    const node = {
      textContent: 'link text',
    } as unknown as Node;

    const mark = {
      attrs: {
        uuid: 'link-uuid-nohref',
        type: 'link',
      },
      type: { name: 'link' },
    } as unknown as Mark;

    const result = link({
      node,
      mark,
      parent: node,
      root: node,
      start: 0,
      passageUuid: 'passage-uuid-1234',
    });

    expect(result).toBeUndefined();
  });

  it('should return undefined when type is invalid', () => {
    const node = {
      textContent: 'link text',
    } as unknown as Node;

    const mark = {
      attrs: {
        uuid: 'link-uuid-invalid',
        type: 'invalidType',
        href: 'https://example.com',
      },
      type: { name: 'invalidType' },
    } as unknown as Mark;

    const result = link({
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
