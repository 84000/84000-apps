import type { GraphQLClient } from 'graphql-request';
import { WorkDocument } from '@eightyfourthousand/lib-doc-model';
import { Schema } from '@tiptap/pm/model';

import { SpineFeed } from './spine-feed';

jest.mock('@eightyfourthousand/client-graphql', () => ({
  getPassageMetaPage: jest.fn(),
}));

const clientGraphql = jest.requireMock(
  '@eightyfourthousand/client-graphql',
) as {
  getPassageMetaPage: jest.Mock;
};

/** Minimal schema — the feed touches the spine only, never a passage document. */
const schema = new Schema({
  nodes: {
    doc: { content: 'block+' },
    paragraph: { group: 'block', content: 'inline*', toDOM: () => ['p', 0] },
    text: { group: 'inline' },
  },
});

const client = {} as GraphQLClient;

const work = () => new WorkDocument({ workUuid: 'w1', schema });

/** One page of `count` passages, labelled from `from`. */
const metaPage = (from: number, count: number, hasMoreAfter: boolean) => ({
  metas: Array.from({ length: count }, (_, i) => ({
    uuid: `p${from + i}`,
    label: `${from + i + 1}`,
    sort: (from + i) * 2,
    type: 'translation',
    toh: undefined,
  })),
  nextCursor: hasMoreAfter ? `p${from + count - 1}` : undefined,
  hasMoreAfter,
});

beforeEach(() => clientGraphql.getPassageMetaPage.mockReset());

describe('SpineFeed', () => {
  it('seeds only the first page, not the whole work', async () => {
    const w = work();
    clientGraphql.getPassageMetaPage.mockResolvedValue(metaPage(0, 100, true));

    expect(await new SpineFeed(w, client).seed()).toBe(100);
    expect(clientGraphql.getPassageMetaPage).toHaveBeenCalledTimes(1);
    expect(w.spine.length).toBe(100);
  });

  it('appends the next page in order, continuing from the cursor', async () => {
    const w = work();
    const feed = new SpineFeed(w, client);
    clientGraphql.getPassageMetaPage
      .mockResolvedValueOnce(metaPage(0, 100, true))
      .mockResolvedValueOnce(metaPage(100, 100, true));

    await feed.seed();
    await feed.extend();

    expect(w.spine.length).toBe(200);
    expect(w.spine.uuidAt(0)).toBe('p0');
    expect(w.spine.uuidAt(199)).toBe('p199');
    expect(clientGraphql.getPassageMetaPage.mock.calls[1][0].cursor).toBe(
      'p99',
    );
  });

  it('keeps the server labels rather than renumbering a partial spine', async () => {
    const w = work();
    const feed = new SpineFeed(w, client);
    clientGraphql.getPassageMetaPage.mockResolvedValueOnce({
      metas: [
        { uuid: 'a', label: 'i.1', sort: 0, type: 'introduction' },
        { uuid: 'b', label: '1.1', sort: 2, type: 'translation' },
        { uuid: 'c', label: '1.2', sort: 4, type: 'translation' },
      ],
      hasMoreAfter: false,
    });

    await feed.seed();

    // Renumbering here would rewrite '1.1' from the 'i.1' above it.
    expect(w.spine.entries().map((e) => e.label)).toEqual([
      'i.1',
      '1.1',
      '1.2',
    ]);
  });

  it('reports no more once the server says the work has ended', async () => {
    const w = work();
    const feed = new SpineFeed(w, client);
    clientGraphql.getPassageMetaPage.mockResolvedValue(metaPage(0, 40, false));

    await feed.seed();

    expect(feed.hasMore).toBe(false);
    await feed.extend();
    expect(clientGraphql.getPassageMetaPage).toHaveBeenCalledTimes(1);
  });

  it('stops on a failed page rather than appending after a hole', async () => {
    const w = work();
    const feed = new SpineFeed(w, client);
    clientGraphql.getPassageMetaPage
      .mockResolvedValueOnce(metaPage(0, 100, true))
      // getPassageMetaPage reports a failure as an empty page.
      .mockResolvedValueOnce({ metas: [], hasMoreAfter: false });

    await feed.seed();
    await feed.extend();

    expect(w.spine.length).toBe(100);
    expect(feed.hasMore).toBe(false);
  });

  it('shares one request across concurrent extends', async () => {
    const w = work();
    const feed = new SpineFeed(w, client);
    clientGraphql.getPassageMetaPage.mockResolvedValue(metaPage(0, 100, true));

    await Promise.all([feed.extend(), feed.extend(), feed.extend()]);

    // A burst of scroll events must not append the same page three times.
    expect(clientGraphql.getPassageMetaPage).toHaveBeenCalledTimes(1);
    expect(w.spine.length).toBe(100);
  });

  it('extends only when the window nears the end of the loaded spine', async () => {
    const w = work();
    const feed = new SpineFeed(w, client);
    clientGraphql.getPassageMetaPage.mockResolvedValue(metaPage(0, 100, true));
    await feed.seed();
    clientGraphql.getPassageMetaPage.mockClear();

    expect(feed.maybeExtend(10)).toBe(false);
    expect(clientGraphql.getPassageMetaPage).not.toHaveBeenCalled();

    expect(feed.maybeExtend(70)).toBe(true);
  });

  it('leaves a spine somebody else populated alone', async () => {
    const w = work();
    w.seedSpine([{ uuid: 'x', label: '1', type: 'translation' }]);

    expect(await new SpineFeed(w, client).seed()).toBe(1);
    expect(clientGraphql.getPassageMetaPage).not.toHaveBeenCalled();
  });
});
