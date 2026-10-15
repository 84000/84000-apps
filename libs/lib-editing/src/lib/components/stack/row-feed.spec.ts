import { WorkDocument } from '@eightyfourthousand/lib-doc-model';
import { Schema } from '@tiptap/pm/model';

import { RowFeed, type RowMeta, type RowPages } from './spine-feed';
import type { StackRowFeed } from './types';

const schema = new Schema({
  nodes: {
    doc: { content: 'block+' },
    paragraph: { group: 'block', content: 'inline*', toDOM: () => ['p', 0] },
    text: { group: 'inline' },
  },
});

/** Two headings with entries under them, as a bibliography stores them. */
const ROWS: RowMeta[] = [
  { uuid: 'h1', label: '', type: 'bibliographyHeader', sort: 1 },
  {
    uuid: 'e1',
    label: '',
    type: 'bibliography',
    sort: 2,
    parent: 'h1',
    depth: 1,
  },
  {
    uuid: 'e2',
    label: '',
    type: 'bibliography',
    sort: 3,
    parent: 'h1',
    depth: 1,
  },
  { uuid: 'h2', label: '', type: 'bibliographyHeader', sort: 4 },
  {
    uuid: 'e3',
    label: '',
    type: 'bibliography',
    sort: 5,
    parent: 'h2',
    depth: 1,
  },
];

/** Pages over `ROWS`, `size` at a time, forward from a cursor. */
const pagesOver = (size: number): RowPages & { metas: jest.Mock } => ({
  metas: jest.fn(async ({ cursor }: { cursor?: string }) => {
    const from = cursor ? ROWS.findIndex((row) => row.uuid === cursor) + 1 : 0;
    const metas = ROWS.slice(from, from + size);
    const more = from + size < ROWS.length;
    return {
      metas,
      nextCursor: more ? metas[metas.length - 1]?.uuid : undefined,
      hasMoreAfter: more,
      hasMoreBefore: false,
    };
  }),
  content: jest.fn(async () => null),
});

describe('RowFeed over rows that are not passages', () => {
  it('fills a tab’s run from its own reader', async () => {
    const work = new WorkDocument({ workUuid: 'w1', schema });
    const pages = pagesOver(3);
    const feed: StackRowFeed = new RowFeed(work, pages, 'bibliography');

    await (feed as RowFeed).seed();
    await feed.extend?.();

    expect(work.spine.tab('bibliography').map((entry) => entry.uuid)).toEqual([
      'h1',
      'e1',
      'e2',
      'h2',
      'e3',
    ]);
    expect(work.spine.meta('e3')).toMatchObject({ parent: 'h2', depth: 1 });
    expect(feed.hasMore).toBe(false);
    work.destroy();
  });

  it('reads past the run through the reader, not the API', async () => {
    const work = new WorkDocument({ workUuid: 'w1', schema });
    const pages = pagesOver(5);
    const feed = new RowFeed(work, pages, 'bibliography');

    await feed.readBeyond('after', 'e3');

    expect(pages.content).toHaveBeenCalledWith({
      cursor: 'e3',
      limit: 100,
      direction: 'after',
    });
    work.destroy();
  });
});
