import { getTranslationBlocks } from '@eightyfourthousand/client-graphql';
import type { GraphQLClient } from 'graphql-request';

import {
  loadStaticPassages,
  renderStaticPassageHTML,
} from './static-passage-html';

jest.mock('@eightyfourthousand/client-graphql', () => ({
  getTranslationBlocks: jest.fn(),
}));

const blocks = getTranslationBlocks as jest.Mock;

/** The passage node the API serves as `json`. */
const passage = (uuid: string, text: string) => ({
  type: 'passage',
  attrs: { uuid, label: '1.1', type: 'translation' },
  content: [{ type: 'paragraph', content: [{ type: 'text', text }] }],
});

describe('renderStaticPassageHTML', () => {
  it('draws a passage node as its blocks, without the passage chrome', () => {
    const html = renderStaticPassageHTML(passage('p1', 'Thus did I hear'));

    expect(html).toContain('Thus did I hear');
    expect(html).not.toContain('1.1');
    expect(html).not.toContain('data-passage-label');
  });

  it('draws the same HTML from the blocks alone', () => {
    const node = passage('p1', 'Thus did I hear');

    expect(renderStaticPassageHTML(node.content)).toBe(
      renderStaticPassageHTML(node),
    );
    expect(
      renderStaticPassageHTML({ type: 'doc', content: node.content }),
    ).toBe(renderStaticPassageHTML(node));
  });
});

describe('loadStaticPassages', () => {
  const client = {} as GraphQLClient;

  beforeEach(() => blocks.mockReset());

  it('reads the passages of one work and keys their HTML by uuid', async () => {
    blocks.mockResolvedValue({
      blocks: [passage('p1', 'one'), passage('p2', 'two')],
      hasMoreAfter: false,
      hasMoreBefore: false,
    });

    const html = await loadStaticPassages({
      client,
      workUuid: 'w1',
      uuids: ['p1', 'p2', 'p1'],
    });

    expect(blocks).toHaveBeenCalledWith({
      client,
      uuid: 'w1',
      uuids: ['p1', 'p2'],
      maxPassages: 2,
    });
    expect(html.get('p1')).toContain('one');
    expect(html.get('p2')).toContain('two');
  });

  it('reads more than a page in pages', async () => {
    blocks.mockResolvedValue({
      blocks: [],
      hasMoreAfter: false,
      hasMoreBefore: false,
    });
    const uuids = Array.from({ length: 150 }, (_, i) => `p${i}`);

    await loadStaticPassages({ client, workUuid: 'w1', uuids });

    expect(blocks).toHaveBeenCalledTimes(2);
    expect(blocks.mock.calls[0][0].uuids).toHaveLength(100);
    expect(blocks.mock.calls[1][0].uuids).toHaveLength(50);
  });

  it('leaves out passages it could not read', async () => {
    blocks.mockResolvedValue({
      blocks: [],
      hasMoreAfter: false,
      hasMoreBefore: false,
      failed: true,
    });

    const html = await loadStaticPassages({
      client,
      workUuid: 'w1',
      uuids: ['p1'],
    });

    expect(html.size).toBe(0);
  });
});
