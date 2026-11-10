/**
 * Acceptance tests for DEV-837 item 4a, AC3: `loadStackReaderSeed` seeds
 * content for the first passages of every section, not only the main panel's.
 *
 * Written from the spec, not the implementation: only the GraphQL reads are
 * faked.
 */
import { loadStackReaderSeed } from './stack-reader-seed';
import { STACK_SECTIONS } from './stack-seed';

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
});
