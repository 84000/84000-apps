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
  it('starts after the passage preceding the run', async () => {
    const spine = spineOf(20);
    clientGraphql.getTranslationBlocks.mockResolvedValue(
      page(['p5', 'p6', 'p7']),
    );
    const source = graphqlPassageSource({
      client,
      workUuid: 'w1',
      spine: () => spine,
    });

    await source.loadPassages('w1', ['p5', 'p6', 'p7']);

    expect(clientGraphql.getTranslationBlocks).toHaveBeenCalledTimes(1);
    expect(clientGraphql.getTranslationBlocks).toHaveBeenCalledWith(
      expect.objectContaining({ cursor: 'p4', maxPassages: 3 }),
    );
  });

  // The cursor is exclusive, so a run starting at the top of the spine has no
  // loaded passage to start after. `AROUND` includes its own cursor, which is
  // the row that would otherwise never be fetched.
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
    clientGraphql.getTranslationBlocks.mockResolvedValue(
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

    expect(clientGraphql.getTranslationBlocks).toHaveBeenCalledWith(
      expect.objectContaining({ cursor: 'p2', maxPassages: 4 }),
    );
    // Passages pulled in by the span but not asked for are dropped: the loader
    // treats anything returned as answered.
    expect(found.map((s) => s.uuid)).toEqual(['p3', 'p6']);
  });

  it('pages when the run is longer than the server page limit', async () => {
    const spine = spineOf(250);
    // From p1, so the run has a passage before it and takes the cursor path.
    const first = Array.from({ length: 100 }, (_, i) => `p${i + 1}`);
    const second = Array.from({ length: 20 }, (_, i) => `p${101 + i}`);
    clientGraphql.getTranslationBlocks
      .mockResolvedValueOnce(page(first, true))
      .mockResolvedValueOnce(page(second));

    const source = graphqlPassageSource({
      client,
      workUuid: 'w1',
      spine: () => spine,
    });
    const found = await source.loadPassages('w1', [...first, ...second]);

    expect(clientGraphql.getTranslationBlocks).toHaveBeenCalledTimes(2);
    expect(
      clientGraphql.getTranslationBlocks.mock.calls[0][0].maxPassages,
    ).toBe(100);
    expect(
      clientGraphql.getTranslationBlocks.mock.calls[1][0].maxPassages,
    ).toBe(20);
    expect(found).toHaveLength(120);
  });

  it('stops rather than looping when a page comes back empty', async () => {
    const spine = spineOf(20);
    clientGraphql.getTranslationBlocks.mockResolvedValue(page([]));
    const source = graphqlPassageSource({
      client,
      workUuid: 'w1',
      spine: () => spine,
    });

    expect(await source.loadPassages('w1', ['p5', 'p6'])).toEqual([]);
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
