/**
 * Acceptance tests for DEV-837 item 4a, AC3: `loadStackReaderSeed` seeds
 * content for the first passages of every section, not only the main panel's.
 *
 * Written from the spec, not the implementation: only the GraphQL reads are
 * faked.
 */
import {
  BODY_MATTER_FILTER,
  FRONT_MATTER_FILTER,
} from '@eightyfourthousand/data-access';

import { loadStackReaderSeed } from './stack-reader-seed';
import { FIRST_PAGE, STACK_SECTIONS } from './stack-seed';

jest.mock('@eightyfourthousand/client-graphql/ssr', () => ({
  getPassageMetaPage: jest.fn(),
  getTranslationBlocks: jest.fn(),
  // The bibliography the seed also reads; these tests are about the sections.
  getWorkBibliography: jest.fn(async () => []),
}));

const api = jest.requireMock('@eightyfourthousand/client-graphql/ssr') as {
  getPassageMetaPage: jest.Mock;
  getTranslationBlocks: jest.Mock;
};

const CLIENT = { name: 'client' } as never;
const TABS = ['front', 'translation', 'abbreviations', 'endnotes'];
const TYPE_OF: Record<string, string> = Object.fromEntries(
  STACK_SECTIONS.map(({ tab, type }) => [tab, type]),
);
const TAB_OF: Record<string, string> = Object.fromEntries(
  STACK_SECTIONS.map(({ tab, type }) => [type, tab]),
);

const page = (type: string) => ({
  metas: [{ uuid: `${TAB_OF[type]}-0`, label: '1', type }],
  nextCursor: `${TAB_OF[type]}-0`,
  hasMoreAfter: true,
  hasMoreBefore: false,
});

const block = (uuid: string) => ({
  type: 'passage',
  attrs: { uuid },
  content: [{ type: 'paragraph' }],
});

/** The first `count` passages of a section, as the API serves them. */
const blocksOf = (type: string, count: number) => ({
  blocks: Array.from({ length: count }, (_, i) =>
    block(`${TAB_OF[type]}-${i}`),
  ),
});

beforeEach(() => {
  api.getPassageMetaPage
    .mockReset()
    .mockImplementation(async ({ type }) => page(type));
  api.getTranslationBlocks
    .mockReset()
    .mockImplementation(async ({ type, maxPassages }) =>
      blocksOf(type, Math.min(3, maxPassages ?? 100)),
    );
});

const load = () => loadStackReaderSeed({ client: CLIENT, workUuid: 'w1' });

describe('loadStackReaderSeed (AC3)', () => {
  it('seeds the four sections in the order the work reads', async () => {
    const seed = await load();

    expect(seed.workUuid).toBe('w1');
    expect(seed.sections.map(({ tab }) => tab)).toEqual(TABS);
  });

  it('reads each section’s first page of metadata, whatever the section', async () => {
    const seed = await load();

    for (const tab of TABS) {
      expect(api.getPassageMetaPage).toHaveBeenCalledWith(
        expect.objectContaining({
          client: CLIENT,
          uuid: 'w1',
          type: TYPE_OF[tab],
          limit: FIRST_PAGE,
        }),
      );
      const section = seed.sections.find((each) => each.tab === tab);
      expect(section?.page).toEqual(page(TYPE_OF[tab]));
    }
  });

  it('reads content for every section, up to 40 of its first passages', async () => {
    await load();

    const reads = api.getTranslationBlocks.mock.calls.map(([args]) => args);
    expect(reads.map(({ type }) => type).sort()).toEqual(
      TABS.map((tab) => TYPE_OF[tab]).sort(),
    );
    for (const read of reads) {
      expect(read).toEqual(
        expect.objectContaining({
          client: CLIENT,
          uuid: 'w1',
          maxPassages: 40,
        }),
      );
    }
    // The back matter included, which the main panel's seed left out.
    expect(reads.map(({ type }) => type)).toEqual(
      expect.arrayContaining(['abbreviations', 'endnotes']),
    );
    expect(reads.map(({ type }) => type)).toEqual(
      expect.arrayContaining([FRONT_MATTER_FILTER, BODY_MATTER_FILTER]),
    );
  });

  it('puts each section’s passages in its own section', async () => {
    const seed = await load();

    for (const { tab, passages } of seed.sections) {
      expect(passages.map(({ uuid }) => uuid)).toEqual([
        `${tab}-0`,
        `${tab}-1`,
        `${tab}-2`,
      ]);
      expect(passages[0].content).toEqual([{ type: 'paragraph' }]);
    }
  });

  it('holds no more than the 40 passages asked for, when the read gives them', async () => {
    api.getTranslationBlocks.mockImplementation(async ({ type, maxPassages }) =>
      blocksOf(type, maxPassages ?? 100),
    );

    const seed = await load();

    for (const { passages } of seed.sections) {
      expect(passages).toHaveLength(40);
    }
  });

  it('seeds a section whose content read failed with no passages, and keeps the others', async () => {
    api.getTranslationBlocks.mockImplementation(async ({ type }) =>
      type === 'endnotes' ? { blocks: [], failed: true } : blocksOf(type, 2),
    );

    const seed = await load();
    const byTab = Object.fromEntries(
      seed.sections.map((section) => [section.tab, section]),
    );

    expect(byTab.endnotes.passages).toEqual([]);
    // Its metadata is still there for the feed to continue from.
    expect(byTab.endnotes.page).toEqual(page('endnotes'));
    expect(byTab.front.passages).toHaveLength(2);
    expect(byTab.translation.passages).toHaveLength(2);
    expect(byTab.abbreviations.passages).toHaveLength(2);
  });

  it('seeds every section empty when every content read failed', async () => {
    api.getTranslationBlocks.mockResolvedValue({ blocks: [], failed: true });

    const seed = await load();

    expect(seed.sections.map(({ tab }) => tab)).toEqual(TABS);
    expect(seed.sections.every(({ passages }) => passages.length === 0)).toBe(
      true,
    );
  });
});
