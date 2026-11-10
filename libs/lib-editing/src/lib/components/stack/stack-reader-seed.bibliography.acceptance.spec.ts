/**
 * Acceptance tests for DEV-837 item 4b, AC1: `loadStackReaderSeed` also reads
 * the work's bibliography, through `getWorkBibliography`, and returns it as
 * `bibliography`.
 *
 * Written from the spec, not the implementation: only the GraphQL reads are
 * faked.
 */
import { loadStackReaderSeed } from './stack-reader-seed';

jest.mock('@eightyfourthousand/client-graphql/ssr', () => ({
  getPassageMetaPage: jest.fn(),
  getTranslationBlocks: jest.fn(),
  getWorkBibliography: jest.fn(),
}));

const api = jest.requireMock('@eightyfourthousand/client-graphql/ssr') as {
  getPassageMetaPage: jest.Mock;
  getTranslationBlocks: jest.Mock;
  getWorkBibliography: jest.Mock;
};

const CLIENT = { name: 'client' } as never;
const WORK = 'w1';

const BIBLIOGRAPHY = [
  {
    heading: 'Tibetan Texts',
    label: '1',
    entries: [
      {
        uuid: 'e1',
        label: '1.1',
        html: '<p><em>First</em> source</p>',
        workUuid: 'w-a',
      },
      {
        uuid: 'e2',
        label: '1.2',
        html: '<p>Second source</p>',
        workUuid: 'w-b',
      },
    ],
  },
  {
    heading: 'Secondary Sources',
    label: '2',
    entries: [
      {
        uuid: 'e3',
        label: '2.1',
        html: '<p>Third source</p>',
        workUuid: 'w-c',
      },
    ],
  },
];

beforeEach(() => {
  api.getPassageMetaPage.mockReset().mockResolvedValue({
    metas: [],
    hasMoreAfter: false,
    hasMoreBefore: false,
  });
  api.getTranslationBlocks.mockReset().mockResolvedValue({ blocks: [] });
  api.getWorkBibliography.mockReset().mockResolvedValue(BIBLIOGRAPHY);
});

// The base seed type has no `bibliography`; the spec adds it.
type SeedWithBibliography = Awaited<ReturnType<typeof loadStackReaderSeed>> & {
  bibliography: unknown;
};
const load = async () =>
  (await loadStackReaderSeed({
    client: CLIENT,
    workUuid: WORK,
  })) as SeedWithBibliography;

describe('loadStackReaderSeed bibliography (4b AC1)', () => {
  it('stays plain, serializable data', async () => {
    const seed = await load();

    expect(JSON.parse(JSON.stringify(seed))).toEqual(seed);
  });
});
