import type { GraphQLClient } from 'graphql-request';
import { WorkDocument } from '@eightyfourthousand/lib-doc-model';
import { Schema } from '@tiptap/pm/model';

import { SpineFeed } from './spine-feed';
import { dirtyPassages } from './stack-save';

jest.mock('@eightyfourthousand/client-graphql', () => ({
  getPassageMetaPage: jest.fn(),
  getTranslationBlocks: jest.fn(),
}));

const clientGraphql = jest.requireMock(
  '@eightyfourthousand/client-graphql',
) as {
  getPassageMetaPage: jest.Mock;
  getTranslationBlocks: jest.Mock;
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
const metaPage = (
  from: number,
  count: number,
  hasMoreAfter: boolean,
  type = 'translation',
  prefix = 'p',
) => ({
  metas: Array.from({ length: count }, (_, i) => ({
    uuid: `${prefix}${from + i}`,
    label: `${from + i + 1}`,
    sort: (from + i) * 2,
    type,
    toh: undefined,
    contentLength: (from + i + 1) * 10,
  })),
  nextCursor: hasMoreAfter ? `${prefix}${from + count - 1}` : undefined,
  hasMoreAfter,
  hasMoreBefore: false,
});

/** A page centred on a passage, as `direction: 'AROUND'` returns it. */
const aroundPage = (
  from: number,
  count: number,
  { before = true, after = true } = {},
) => ({
  metas: Array.from({ length: count }, (_, i) => ({
    uuid: `p${from + i}`,
    label: `${from + i + 1}`,
    sort: (from + i) * 2,
    type: 'translation',
    toh: undefined,
    contentLength: (from + i + 1) * 10,
  })),
  prevCursor: before ? `p${from}` : undefined,
  nextCursor: after ? `p${from + count - 1}` : undefined,
  hasMoreBefore: before,
  hasMoreAfter: after,
});

beforeEach(() => {
  clientGraphql.getPassageMetaPage.mockReset();
  clientGraphql.getTranslationBlocks.mockReset();
});

describe('SpineFeed.readBeyond', () => {
  const FRONT = { type: '(introduction)', tab: 'front' };
  const block = (uuid: string) => ({
    type: 'passage',
    attrs: { uuid },
    content: [{ type: 'paragraph' }],
  });

  it('reads its own section past the cursor, leaving the spine alone', async () => {
    const w = work();
    const feed = new SpineFeed(w, client, FRONT);
    clientGraphql.getTranslationBlocks.mockResolvedValueOnce({
      blocks: [block('f1'), block('f2')],
      prevCursor: 'f1',
      hasMoreBefore: true,
      hasMoreAfter: true,
    });

    expect(await feed.readBeyond('before', 'f3')).toEqual({
      passages: [
        { uuid: 'f1', content: [{ type: 'paragraph' }] },
        { uuid: 'f2', content: [{ type: 'paragraph' }] },
      ],
      next: 'f1',
    });
    expect(clientGraphql.getTranslationBlocks).toHaveBeenCalledWith(
      expect.objectContaining({
        type: '(introduction)',
        cursor: 'f3',
        direction: 'backward',
      }),
    );
    expect(w.spine.length).toBe(0);
  });

  it('says where nothing more lies that way', async () => {
    const feed = new SpineFeed(work(), client, FRONT);
    clientGraphql.getTranslationBlocks.mockResolvedValueOnce({
      blocks: [block('f9')],
      nextCursor: 'f9',
      hasMoreBefore: true,
      hasMoreAfter: false,
    });

    expect(await feed.readBeyond('after', 'f8')).toEqual({
      passages: [{ uuid: 'f9', content: [{ type: 'paragraph' }] }],
    });
  });

  it('tells a failed read from an empty one', async () => {
    const feed = new SpineFeed(work(), client, FRONT);
    clientGraphql.getTranslationBlocks.mockResolvedValueOnce({
      blocks: [],
      hasMoreBefore: false,
      hasMoreAfter: false,
      failed: true,
    });

    expect(await feed.readBeyond('before', 'f1')).toBeNull();
  });
});

describe('SpineFeed content lengths', () => {
  it('records the content length of every passage a page reports', async () => {
    const w = work();
    clientGraphql.getPassageMetaPage.mockResolvedValue(metaPage(0, 3, false));

    const feed = new SpineFeed(w, client);
    await feed.seed();

    expect(feed.contentLength('p0')).toBe(10);
    expect(feed.contentLength('p2')).toBe(30);
  });

  it('reports nothing for a passage no page has covered', async () => {
    const w = work();
    clientGraphql.getPassageMetaPage.mockResolvedValue(metaPage(0, 3, false));

    const feed = new SpineFeed(w, client);
    await feed.seed();

    expect(feed.contentLength('p99')).toBeUndefined();
  });
});

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

  describe('reveal', () => {
    it('returns the index of a passage the spine already holds', async () => {
      const w = work();
      const feed = new SpineFeed(w, client);
      clientGraphql.getPassageMetaPage.mockResolvedValueOnce(
        metaPage(0, 5, false),
      );
      await feed.seed();

      expect(await feed.reveal('p3')).toBe(3);
      // Already loaded, so no second request.
      expect(clientGraphql.getPassageMetaPage).toHaveBeenCalledTimes(1);
    });

    // The whole point: a link to passage 15,000 costs one request, not the
    // hundred and fifty that paging from the top would.
    it('rebuilds the spine around a passage it has never loaded', async () => {
      const w = work();
      const feed = new SpineFeed(w, client);
      clientGraphql.getPassageMetaPage.mockResolvedValueOnce(
        metaPage(0, 5, true),
      );
      await feed.seed();

      clientGraphql.getPassageMetaPage.mockResolvedValueOnce(
        aroundPage(500, 4),
      );
      expect(await feed.reveal('p502')).toBe(2);

      expect(clientGraphql.getPassageMetaPage).toHaveBeenLastCalledWith(
        expect.objectContaining({ cursor: 'p502', direction: 'AROUND' }),
      );
      expect(w.spine.uuids()).toEqual(['p500', 'p501', 'p502', 'p503']);
      expect(feed.hasMoreBefore).toBe(true);
      expect(feed.hasMore).toBe(true);
    });

    it('reports -1 for a passage the work does not have', async () => {
      const w = work();
      const feed = new SpineFeed(w, client);
      clientGraphql.getPassageMetaPage.mockResolvedValueOnce({
        metas: [],
        hasMoreAfter: false,
        hasMoreBefore: false,
      });

      expect(await feed.reveal('nope')).toBe(-1);
    });
  });

  describe('growing upward', () => {
    /** A revealed spine, sitting mid-work with passages either side. */
    const revealed = async () => {
      const w = work();
      const feed = new SpineFeed(w, client);
      clientGraphql.getPassageMetaPage.mockResolvedValueOnce(
        aroundPage(500, 3),
      );
      await feed.reveal('p501');
      clientGraphql.getPassageMetaPage.mockReset();
      return { w, feed };
    };

    // The titles over the front matter follow `hasMoreBefore`, read when the
    // spine notifies.
    it.each([
      ['prepending the first page', (feed: SpineFeed) => feed.extendBefore()],
      ['going back to the start', (feed: SpineFeed) => feed.revealStart()],
    ])('reports no more before by the time %s lands', async (_, move) => {
      const { w, feed } = await revealed();
      clientGraphql.getPassageMetaPage.mockResolvedValueOnce(
        aroundPage(497, 3, { before: false }),
      );
      const seen: boolean[] = [];
      w.spine.observe(() => seen.push(feed.hasMoreBefore));

      await move(feed);

      expect(seen.length).toBeGreaterThan(0);
      expect(seen.at(-1)).toBe(false);
    });

    // A link to the imprint, over a front matter window opened part way.
    it('goes back to the start of the run', async () => {
      const { w, feed } = await revealed();
      clientGraphql.getPassageMetaPage.mockResolvedValueOnce(
        metaPage(0, 2, true),
      );

      await feed.revealStart();

      // No cursor: from the beginning.
      expect(
        clientGraphql.getPassageMetaPage.mock.calls[0][0].cursor,
      ).toBeUndefined();
      expect(w.spine.uuids()).toEqual(['p0', 'p1']);
      expect(feed.hasMoreBefore).toBe(false);
      expect(feed.hasMore).toBe(true);
    });

    it('asks for nothing when the run already starts at the top', async () => {
      const w = work();
      const feed = new SpineFeed(w, client);
      clientGraphql.getPassageMetaPage.mockResolvedValueOnce(
        metaPage(0, 2, false),
      );
      await feed.seed();
      clientGraphql.getPassageMetaPage.mockReset();

      await feed.revealStart();

      expect(clientGraphql.getPassageMetaPage).not.toHaveBeenCalled();
      expect(w.spine.uuids()).toEqual(['p0', 'p1']);
    });

    it('prepends the previous page, keeping the order', async () => {
      const { w, feed } = await revealed();
      clientGraphql.getPassageMetaPage.mockResolvedValueOnce({
        ...aroundPage(497, 3, { before: false }),
        nextCursor: undefined,
      });

      await feed.extendBefore();

      expect(clientGraphql.getPassageMetaPage).toHaveBeenCalledWith(
        expect.objectContaining({ cursor: 'p500', direction: 'BACKWARD' }),
      );
      expect(w.spine.uuids()).toEqual([
        'p497',
        'p498',
        'p499',
        'p500',
        'p501',
        'p502',
      ]);
      expect(feed.hasMoreBefore).toBe(false);
    });

    it('does not read backward from a spine that starts at the work', async () => {
      const w = work();
      const feed = new SpineFeed(w, client);
      clientGraphql.getPassageMetaPage.mockResolvedValueOnce(
        metaPage(0, 3, true),
      );
      await feed.seed();
      clientGraphql.getPassageMetaPage.mockReset();

      await feed.extendBefore();
      expect(clientGraphql.getPassageMetaPage).not.toHaveBeenCalled();
      expect(w.spine.uuids()).toEqual(['p0', 'p1', 'p2']);
    });

    // Unlike downward, which loads ahead of a fast scroll: a prepend moves
    // every row below it, so it may not happen until the reader is actually at
    // the top and asking for it.
    it('extends upward only once the window reaches the top', async () => {
      const { feed } = await revealed();
      expect(feed.maybeExtendBefore(80)).toBe(false);
      expect(feed.maybeExtendBefore(2)).toBe(false);
      expect(clientGraphql.getPassageMetaPage).not.toHaveBeenCalled();

      clientGraphql.getPassageMetaPage.mockResolvedValueOnce(
        aroundPage(497, 3, { before: false }),
      );
      expect(feed.maybeExtendBefore(0)).toBe(true);
    });

    it('shares one request across concurrent backward extends', async () => {
      const { feed } = await revealed();
      clientGraphql.getPassageMetaPage.mockResolvedValueOnce(
        aroundPage(497, 3, { before: false }),
      );

      await Promise.all([feed.extendBefore(), feed.extendBefore()]);
      expect(clientGraphql.getPassageMetaPage).toHaveBeenCalledTimes(1);
    });
  });

  // The editor loads a panel at a time, so the runs arrive independently and
  // must not disturb each other. Sections do not interleave, so each run grows
  // at its own end.
  describe('sections', () => {
    const TRANSLATION = { type: '(translation)', tab: 'translation' };
    const ENDNOTES = { type: '(endnotes)', tab: 'endnotes' };

    /** Both runs seeded, translation first, as the work reads. */
    const both = async () => {
      const w = work();
      const main = new SpineFeed(w, client, TRANSLATION);
      const notes = new SpineFeed(w, client, ENDNOTES);

      clientGraphql.getPassageMetaPage.mockResolvedValueOnce(
        metaPage(0, 2, true),
      );
      await main.seed();
      clientGraphql.getPassageMetaPage.mockResolvedValueOnce(
        metaPage(0, 2, true, 'endnotes', 'n'),
      );
      await notes.seed();
      return { w, main, notes };
    };

    it('keeps the front matter ahead of the body as both grow', async () => {
      const w = work();
      const front = new SpineFeed(w, client, {
        type: '(introduction)',
        tab: 'front',
      });
      const main = new SpineFeed(w, client, TRANSLATION);
      const notes = new SpineFeed(w, client, ENDNOTES);
      clientGraphql.getPassageMetaPage
        .mockResolvedValueOnce(metaPage(0, 2, true, 'introduction', 'f'))
        .mockResolvedValueOnce(metaPage(0, 2, true))
        .mockResolvedValueOnce(metaPage(0, 1, false, 'endnotes', 'n'));
      await front.seed();
      await main.seed();
      await notes.seed();

      clientGraphql.getPassageMetaPage.mockResolvedValueOnce(
        metaPage(2, 1, false, 'introduction', 'f'),
      );
      await front.extend();

      expect(w.spine.uuids()).toEqual(['f0', 'f1', 'f2', 'p0', 'p1', 'n0']);
    });

    it('asks the server for its own section', async () => {
      const w = work();
      const notes = new SpineFeed(w, client, ENDNOTES);
      clientGraphql.getPassageMetaPage.mockResolvedValueOnce(
        metaPage(0, 2, false, 'endnotes', 'n'),
      );

      await notes.seed();

      expect(clientGraphql.getPassageMetaPage).toHaveBeenCalledWith(
        expect.objectContaining({ type: '(endnotes)' }),
      );
    });

    it('seeds each run without the other stopping it', async () => {
      const { w } = await both();
      // A run is seeded only if *its* section is empty, not the spine.
      expect(w.spine.uuids()).toEqual(['p0', 'p1', 'n0', 'n1']);
    });

    it('grows a run at its own end rather than the spine end', async () => {
      const { w, main } = await both();
      clientGraphql.getPassageMetaPage.mockResolvedValueOnce(
        metaPage(2, 2, false),
      );

      await main.extend();

      expect(w.spine.uuids()).toEqual(['p0', 'p1', 'p2', 'p3', 'n0', 'n1']);
    });

    it('replaces only its own run when revealing a passage', async () => {
      const { w, notes } = await both();
      clientGraphql.getPassageMetaPage.mockResolvedValueOnce({
        ...metaPage(90, 2, false, 'endnotes', 'n'),
        prevCursor: 'n90',
        hasMoreBefore: true,
      });

      expect(await notes.reveal('n91')).toBe(3);

      // The translation run is untouched; only the endnotes window moved.
      expect(w.spine.uuids()).toEqual(['p0', 'p1', 'n90', 'n91']);
      // Moving the window unloads passages; it does not delete them.
      expect(w.spine.removedSinceSave()).toEqual([]);
    });

    // A filtered `AROUND` centres on the cursor's position, so a passage of
    // another section still returns a page of this one.
    it('leaves its run alone when the passage is in another section', async () => {
      const { w, main } = await both();
      clientGraphql.getPassageMetaPage.mockResolvedValueOnce({
        ...metaPage(40, 2, false),
        prevCursor: 'p40',
        hasMoreBefore: true,
      });

      expect(await main.reveal('n1-elsewhere')).toBe(-1);

      expect(w.spine.uuids()).toEqual(['p0', 'p1', 'n0', 'n1']);
      expect(main.hasMoreBefore).toBe(false);
    });

    // Following a link reloaded a passage deleted but not saved yet, which
    // cancelled the deletion; after a merge its text was saved twice.
    it('does not bring back a passage deleted but not saved', async () => {
      const { w, notes } = await both();
      w.spine.remove(['n1'], { deleted: true });
      clientGraphql.getPassageMetaPage.mockResolvedValueOnce({
        ...metaPage(0, 3, false, 'endnotes', 'n'),
      });

      expect(await notes.reveal('n2')).toBe(3);

      expect(w.spine.uuids()).toEqual(['p0', 'p1', 'n0', 'n2']);
      expect(w.spine.removedSinceSave()).toEqual(['n1']);
    });

    it('does not page a passage deleted but not saved back in', async () => {
      const { w, notes } = await both();
      w.spine.remove(['n1'], { deleted: true });
      clientGraphql.getPassageMetaPage.mockResolvedValueOnce(
        metaPage(1, 2, false, 'endnotes', 'n'),
      );

      await notes.extend();

      expect(w.spine.uuids()).toEqual(['p0', 'p1', 'n0', 'n2']);
      expect(w.spine.removedSinceSave()).toEqual(['n1']);
    });

    // Moving the window used to replace the run, which took unsaved passages
    // out of the spine and so out of the save: an edit and a split in Front
    // vanished from Save after following a link to the Imprint.
    describe('with unsaved passages in the run', () => {
      const FRONT = { type: '(introduction)', tab: 'front' };

      /** Front opened at f4 by a reveal, with f4 edited and split. */
      const editedMidRun = async () => {
        const w = work();
        const front = new SpineFeed(w, client, FRONT);
        clientGraphql.getPassageMetaPage.mockResolvedValueOnce({
          ...metaPage(4, 2, true, 'introduction', 'f'),
          prevCursor: 'f4',
          hasMoreBefore: true,
        });
        await front.reveal('f4');
        w.store.create('f4', [
          {
            type: 'paragraph',
            content: [{ type: 'text', text: 'front text' }],
          },
        ]);
        w.store.peek('f4')?.markSynced();
        const split = w.split('f4', 4)?.uuid as string;
        return { w, front, split };
      };

      /** What the save would send, by the fields a reload depends on. */
      const payload = (w: ReturnType<typeof work>) =>
        dirtyPassages(w).map(({ uuid, label, sort, type }) => ({
          uuid,
          label,
          sort,
          type,
        }));

      it('keeps an edit and a split saveable when moving to the start', async () => {
        const { w, front, split } = await editedMidRun();
        const before = payload(w);
        expect(before.map((p) => p.uuid)).toEqual(['f4', split]);
        clientGraphql.getPassageMetaPage.mockResolvedValueOnce({
          ...metaPage(0, 4, false, 'introduction', 'f'),
          hasMoreBefore: false,
        });

        await front.revealStart();

        // Grown back to the start rather than replaced from it.
        expect(clientGraphql.getPassageMetaPage).toHaveBeenLastCalledWith(
          expect.objectContaining({ cursor: 'f4', direction: 'BACKWARD' }),
        );
        expect(w.spine.uuids()).toEqual([
          'f0',
          'f1',
          'f2',
          'f3',
          'f4',
          split,
          'f5',
        ]);
        expect(front.hasMoreBefore).toBe(false);
        // The same rows, labels and sorts: what a reload would read back.
        expect(payload(w)).toEqual(before);
      });

      it('keeps an edit made while moving to the start', async () => {
        const w = work();
        const front = new SpineFeed(w, client, FRONT);
        clientGraphql.getPassageMetaPage.mockResolvedValueOnce({
          ...metaPage(4, 2, true, 'introduction', 'f'),
          prevCursor: 'f4',
          hasMoreBefore: true,
        });
        await front.reveal('f4');
        w.store.create('f4', [
          {
            type: 'paragraph',
            content: [{ type: 'text', text: 'front text' }],
          },
        ]);
        w.store.peek('f4')?.markSynced();
        let reply: (page: ReturnType<typeof metaPage>) => void = () =>
          undefined;
        clientGraphql.getPassageMetaPage
          .mockImplementationOnce(
            () =>
              new Promise((resolve) => {
                reply = resolve;
              }),
          )
          .mockResolvedValueOnce({
            ...metaPage(0, 4, false, 'introduction', 'f'),
            hasMoreBefore: false,
          });

        // Clean when the move starts, edited before its page arrives.
        const move = front.revealStart();
        const split = w.split('f4', 4)?.uuid as string;
        const before = payload(w);
        expect(before.map((p) => p.uuid)).toEqual(['f4', split]);
        reply(metaPage(0, 2, true, 'introduction', 'f'));
        await move;

        expect(w.spine.uuids()).toEqual([
          'f0',
          'f1',
          'f2',
          'f3',
          'f4',
          split,
          'f5',
        ]);
        expect(payload(w)).toEqual(before);
      });

      it('keeps them when revealing a passage past the window', async () => {
        const { w, front, split } = await editedMidRun();
        const before = payload(w);
        clientGraphql.getPassageMetaPage
          .mockResolvedValueOnce({
            ...metaPage(9, 2, true, 'introduction', 'f'),
            prevCursor: 'f9',
            hasMoreBefore: true,
          })
          .mockResolvedValueOnce(metaPage(6, 2, true, 'introduction', 'f'))
          .mockResolvedValueOnce(metaPage(8, 2, true, 'introduction', 'f'));

        expect(await front.reveal('f9')).toBe(6);

        expect(w.spine.uuids()).toEqual([
          'f4',
          split,
          'f5',
          'f6',
          'f7',
          'f8',
          'f9',
        ]);
        expect(payload(w)).toEqual(before);
      });

      it('grows backward toward a passage before the window', async () => {
        const { w, front, split } = await editedMidRun();
        clientGraphql.getPassageMetaPage
          .mockResolvedValueOnce({
            ...metaPage(1, 2, true, 'introduction', 'f'),
            prevCursor: 'f1',
            hasMoreBefore: true,
          })
          .mockResolvedValueOnce({
            ...metaPage(2, 2, true, 'introduction', 'f'),
            prevCursor: 'f2',
            hasMoreBefore: true,
          });

        expect(await front.reveal('f2')).toBe(0);

        expect(w.spine.uuids()).toEqual(['f2', 'f3', 'f4', split, 'f5']);
        expect(front.hasMoreBefore).toBe(true);
      });

      it('does not find a passage it cannot reach, and keeps them', async () => {
        const { w, front, split } = await editedMidRun();
        const before = payload(w);
        clientGraphql.getPassageMetaPage
          .mockResolvedValueOnce({
            ...metaPage(9, 2, true, 'introduction', 'f'),
            prevCursor: 'f9',
            hasMoreBefore: true,
          })
          // A failed page: no passages, nothing more either side.
          .mockResolvedValueOnce({
            metas: [],
            hasMoreAfter: false,
            hasMoreBefore: false,
          });

        expect(await front.reveal('f9')).toBe(-1);

        expect(w.spine.uuids()).toEqual(['f4', split, 'f5']);
        expect(payload(w)).toEqual(before);
      });

      it('still replaces the run once the changes are saved', async () => {
        const { w, front, split } = await editedMidRun();
        w.store.peek('f4')?.markSynced();
        w.store.peek(split)?.markSynced();
        w.spine.adoptSorts(new Map([[split, 9]]));
        clientGraphql.getPassageMetaPage.mockResolvedValueOnce(
          metaPage(0, 2, true, 'introduction', 'f'),
        );

        await front.revealStart();

        expect(w.spine.uuids()).toEqual(['f0', 'f1']);
      });
    });
  });
});
