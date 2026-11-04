/**
 * Acceptance tests for DEV-837 item 4b, AC1: `loadStackReaderSeed` also reads
 * the work's bibliography, through `getWorkBibliography`, and returns it as
 * `bibliography`.
 *
 * Written from the spec, not the implementation: only the GraphQL reads (and
 * the editor's draft read, to prove it is not used) are faked.
 */
import { loadStackReaderSeed } from './stack-reader-seed';

jest.mock('@eightyfourthousand/client-graphql/ssr', () => ({
  getPassageMetaPage: jest.fn(),
  getTranslationBlocks: jest.fn(),
  getWorkBibliography: jest.fn(),
}));

// The editor's draft read, and the Supabase clients it goes through. The
// reader's seed reads neither.
jest.mock('@eightyfourthousand/data-access', () => ({
  ...jest.requireActual('@eightyfourthousand/data-access'),
  getBibliographyRows: jest.fn(async () => []),
  createBrowserClient: jest.fn(() => ({ from: jest.fn(), rpc: jest.fn() })),
}));

const api = jest.requireMock('@eightyfourthousand/client-graphql/ssr') as {
  getPassageMetaPage: jest.Mock;
  getTranslationBlocks: jest.Mock;
  getWorkBibliography: jest.Mock;
};
const dataAccess = jest.requireMock('@eightyfourthousand/data-access') as {
  getBibliographyRows: jest.Mock;
  createBrowserClient: jest.Mock;
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
  dataAccess.getBibliographyRows.mockClear();
  dataAccess.createBrowserClient.mockClear();
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
  it('returns the work’s bibliography exactly as getWorkBibliography read it', async () => {
    const seed = await load();

    expect(seed.bibliography).toEqual(BIBLIOGRAPHY);
  });

  it('reads the bibliography once, with the client and the work’s uuid', async () => {
    await load();

    expect(api.getWorkBibliography).toHaveBeenCalledTimes(1);
    expect(api.getWorkBibliography).toHaveBeenCalledWith({
      client: CLIENT,
      uuid: WORK,
    });
  });

  it('never reads the editor’s draft rows or touches a Supabase client', async () => {
    await load();

    expect(dataAccess.getBibliographyRows).not.toHaveBeenCalled();
    expect(dataAccess.createBrowserClient).not.toHaveBeenCalled();
  });

  it('seeds an empty bibliography when the read returns its failure value, []', async () => {
    api.getWorkBibliography.mockResolvedValue([]);

    const seed = await load();

    expect(seed.bibliography).toEqual([]);
  });

  it('is still the section seed it was: the work and every section', async () => {
    const seed = await load();

    expect(seed.workUuid).toBe(WORK);
    expect(seed.sections.map(({ tab }) => tab)).toEqual([
      'front',
      'translation',
      'abbreviations',
      'endnotes',
    ]);
  });

  it('stays plain, serializable data', async () => {
    const seed = await load();

    expect(JSON.parse(JSON.stringify(seed))).toEqual(seed);
  });
});
