import type { GraphQLClient } from 'graphql-request';
import { Spine } from '@eightyfourthousand/lib-doc-model';

import { graphqlPassageSource } from './passage-source';

jest.mock('@eightyfourthousand/client-graphql', () => ({
  getPassageMetaPage: jest.fn(),
  getTranslationBlocks: jest.fn(),
  getTranslationBlocksAround: jest.fn(),
}));

// eslint-disable-next-line @typescript-eslint/no-var-requires
const clientGraphql = jest.requireMock(
  '@eightyfourthousand/client-graphql',
) as {
  getPassageMetaPage: jest.Mock;
  getTranslationBlocks: jest.Mock;
  getTranslationBlocksAround: jest.Mock;
};

const client = {} as GraphQLClient;

const seeds = (count: number) =>
  Array.from({ length: count }, (_, i) => ({
    uuid: `p${i}`,
    label: `${i + 1}`,
    type: 'translation' as const,
  }));

const spineOf = (count: number) => {
  const spine = new Spine('w1');
  spine.seed(seeds(count));
  return spine;
};

/**
 * One page as `getTranslationBlocks` returns it: passage nodes carrying
 * identity in `attrs` and the passage's children in `content`.
 */
const page = (uuids: string[], hasMoreAfter = false) => ({
  blocks: uuids.map((uuid) => ({
    type: 'passage',
    attrs: { uuid },
    content: [{ type: 'paragraph' }],
  })),
  nextCursor: hasMoreAfter ? uuids[uuids.length - 1] : undefined,
  hasMoreAfter,
  hasMoreBefore: false,
});

beforeEach(() => {
  clientGraphql.getPassageMetaPage.mockReset();
  clientGraphql.getTranslationBlocks.mockReset();
  clientGraphql.getTranslationBlocksAround.mockReset();
});

describe('graphqlPassageSource loadSpineMetas', () => {
  it('returns the first page as spine seeds, in server order, dropping sort', async () => {
    clientGraphql.getPassageMetaPage.mockResolvedValue({
      metas: [
        { uuid: 'p0', label: '1', sort: 4, type: 'translation', toh: 'toh145' },
        { uuid: 'p1', label: '2', sort: 90, type: 'endnotes', toh: undefined },
      ],
      hasMoreAfter: false,
    });
    const source = graphqlPassageSource({ client, workUuid: 'w1' });

    expect(await source.loadSpineMetas?.('w1')).toEqual([
      { uuid: 'p0', label: '1', type: 'translation', toh: 'toh145' },
      { uuid: 'p1', label: '2', type: 'endnotes', toh: undefined },
    ]);
  });

  it('refuses a work it is not wired to', async () => {
    const source = graphqlPassageSource({ client, workUuid: 'w1' });
    expect(await source.loadSpineMetas?.('other')).toEqual([]);
    expect(clientGraphql.getPassageMetaPage).not.toHaveBeenCalled();
  });
});

describe('graphqlPassageSource loadPassages', () => {
  it('reads from the first passage of the run', async () => {
    const spine = spineOf(20);
    clientGraphql.getTranslationBlocksAround.mockResolvedValue(
      page(['p5', 'p6', 'p7']),
    );
    const source = graphqlPassageSource({
      client,
      workUuid: 'w1',
      spine: () => spine,
    });

    await source.loadPassages('w1', ['p5', 'p6', 'p7']);

    expect(clientGraphql.getTranslationBlocksAround).toHaveBeenCalledWith(
      expect.objectContaining({ passageUuid: 'p5' }),
    );
  });

  // The regression the sandbox caught: the entry before a run in the spine is
  // not the passage before it in the work. A spine holds a run per section
  // with the rest of the work missing between them, so reading forward from
  // the previous entry returns a different section's passages entirely.
  it('does not start from the spine entry before the run', async () => {
    const spine = new Spine('w1');
    spine.seed([
      { uuid: 'body0', label: '1', type: 'translation' },
      { uuid: 'body1', label: '2', type: 'translation' },
      { uuid: 'n0', label: 'n.1', type: 'endnotes' },
      { uuid: 'n1', label: 'n.2', type: 'endnotes' },
    ]);
    clientGraphql.getTranslationBlocksAround.mockResolvedValue(
      page(['n0', 'n1']),
    );
    const source = graphqlPassageSource({
      client,
      workUuid: 'w1',
      spine: () => spine,
    });

    const found = await source.loadPassages('w1', ['n0', 'n1']);

    expect(clientGraphql.getTranslationBlocksAround).toHaveBeenCalledWith(
      expect.objectContaining({ passageUuid: 'n0' }),
    );
    expect(clientGraphql.getTranslationBlocks).not.toHaveBeenCalled();
    expect(found.map((snapshot) => snapshot.uuid)).toEqual(['n0', 'n1']);
  });

  // A work hydrates the union of its open windows, so one call carries both
  // tabs' passages. They meet in the spine with the rest of the work missing
  // between them, so reading them as one span starts in the body and never
  // reaches the endnotes — which is what left the endnotes tab in skeletons.
  it('reads each section separately when a window spans two of them', async () => {
    const spine = new Spine('w1');
    spine.seed([
      { uuid: 'body0', label: '1', type: 'translation' },
      { uuid: 'body1', label: '2', type: 'translation' },
      { uuid: 'n0', label: 'n.1', type: 'endnotes' },
      { uuid: 'n1', label: 'n.2', type: 'endnotes' },
    ]);
    clientGraphql.getTranslationBlocksAround
      .mockResolvedValueOnce(page(['body0', 'body1']))
      .mockResolvedValueOnce(page(['n0', 'n1']));
    const source = graphqlPassageSource({
      client,
      workUuid: 'w1',
      spine: () => spine,
    });

    const found = await source.loadPassages('w1', [
      'body1',
      'n0',
      'body0',
      'n1',
    ]);

    // Adjacent in the spine, but one read each.
    expect(clientGraphql.getTranslationBlocksAround).toHaveBeenCalledTimes(2);
    const cursors = clientGraphql.getTranslationBlocksAround.mock.calls.map(
      (call) => call[0].passageUuid,
    );
    expect(cursors).toEqual(['body0', 'n0']);
    expect(found.map((snapshot) => snapshot.uuid).sort()).toEqual([
      'body0',
      'body1',
      'n0',
      'n1',
    ]);
  });

  it('reads around the first row when nothing is loaded before it', async () => {
    const spine = spineOf(20);
    clientGraphql.getTranslationBlocksAround.mockResolvedValue(
      page(['p0', 'p1']),
    );
    const source = graphqlPassageSource({
      client,
      workUuid: 'w1',
      spine: () => spine,
    });

    const found = await source.loadPassages('w1', ['p0', 'p1']);

    expect(clientGraphql.getTranslationBlocksAround).toHaveBeenCalledWith(
      expect.objectContaining({ passageUuid: 'p0' }),
    );
    expect(clientGraphql.getTranslationBlocks).not.toHaveBeenCalled();
    expect(found.map((snapshot) => snapshot.uuid)).toEqual(['p0', 'p1']);
  });

  // The regression this guards: a spine that opened around a deep link starts
  // mid-work, so reading from the beginning returns a different part of the
  // text and every wanted passage is filtered out as unsupplied.
  it('does not read from the start of the work for a spine that opens mid-work', async () => {
    const spine = new Spine('w1');
    spine.seed([
      { uuid: 'p700', label: '701', type: 'translation' },
      { uuid: 'p701', label: '702', type: 'translation' },
    ]);
    clientGraphql.getTranslationBlocksAround.mockResolvedValue(
      page(['p700', 'p701']),
    );
    const source = graphqlPassageSource({
      client,
      workUuid: 'w1',
      spine: () => spine,
    });

    const found = await source.loadPassages('w1', ['p700', 'p701']);

    expect(clientGraphql.getTranslationBlocksAround).toHaveBeenCalledWith(
      expect.objectContaining({ passageUuid: 'p700' }),
    );
    expect(found).toHaveLength(2);
  });

  it('reads the whole run when the caller already holds part of the middle', async () => {
    const spine = spineOf(20);
    clientGraphql.getTranslationBlocksAround.mockResolvedValue(
      page(['p3', 'p4', 'p5', 'p6']),
    );
    const source = graphqlPassageSource({
      client,
      workUuid: 'w1',
      spine: () => spine,
    });

    // p4 and p5 are held, so only the ends are wanted — one contiguous read
    // still beats two requests for the exact set.
    const found = await source.loadPassages('w1', ['p3', 'p6']);

    expect(clientGraphql.getTranslationBlocksAround).toHaveBeenCalledWith(
      expect.objectContaining({ passageUuid: 'p3' }),
    );
    // Passages pulled in by the span but not asked for are dropped: the loader
    // treats anything returned as answered.
    expect(found.map((s) => s.uuid)).toEqual(['p3', 'p6']);
  });

  // `AROUND` covers the head of the run; anything past it continues forward.
  it('pages when the run is longer than the server page limit', async () => {
    const spine = spineOf(250);
    const first = Array.from({ length: 100 }, (_, i) => `p${i}`);
    const second = Array.from({ length: 20 }, (_, i) => `p${100 + i}`);
    clientGraphql.getTranslationBlocksAround.mockResolvedValue(
      page(first, true),
    );
    clientGraphql.getTranslationBlocks.mockResolvedValueOnce(page(second));

    const source = graphqlPassageSource({
      client,
      workUuid: 'w1',
      spine: () => spine,
    });
    const found = await source.loadPassages('w1', [...first, ...second]);

    expect(clientGraphql.getTranslationBlocksAround).toHaveBeenCalledTimes(1);
    expect(clientGraphql.getTranslationBlocks).toHaveBeenCalledTimes(1);
    expect(
      clientGraphql.getTranslationBlocks.mock.calls[0][0].maxPassages,
    ).toBe(20);
    expect(found).toHaveLength(120);
  });

  it('stops rather than looping when a page comes back empty', async () => {
    const spine = spineOf(250);
    const head = Array.from({ length: 100 }, (_, i) => `p${i}`);
    // The head says there is more, and the continuation comes back empty.
    clientGraphql.getTranslationBlocksAround.mockResolvedValue(
      page(head, true),
    );
    clientGraphql.getTranslationBlocks.mockResolvedValue(page([]));
    const source = graphqlPassageSource({
      client,
      workUuid: 'w1',
      spine: () => spine,
    });

    const wanted = Array.from({ length: 120 }, (_, i) => `p${i}`);
    expect(await source.loadPassages('w1', wanted)).toHaveLength(100);
    expect(clientGraphql.getTranslationBlocks).toHaveBeenCalledTimes(1);
  });

  it('makes no request for an empty uuid list', async () => {
    const source = graphqlPassageSource({ client, workUuid: 'w1' });
    expect(await source.loadPassages('w1', [])).toEqual([]);
    expect(clientGraphql.getTranslationBlocks).not.toHaveBeenCalled();
  });

  it('refuses a work it is not wired to', async () => {
    const source = graphqlPassageSource({ client, workUuid: 'w1' });
    expect(await source.loadPassages('other', ['p0'])).toEqual([]);
    expect(clientGraphql.getTranslationBlocks).not.toHaveBeenCalled();
  });

  it('falls back to reading from the start when it has no spine', async () => {
    clientGraphql.getTranslationBlocks.mockResolvedValue(page(['p0', 'p1']));
    const source = graphqlPassageSource({ client, workUuid: 'w1' });

    const found = await source.loadPassages('w1', ['p1']);

    expect(clientGraphql.getTranslationBlocks).toHaveBeenCalledWith(
      expect.objectContaining({ cursor: undefined, maxPassages: 100 }),
    );
    expect(found.map((s) => s.uuid)).toEqual(['p1']);
  });
});
