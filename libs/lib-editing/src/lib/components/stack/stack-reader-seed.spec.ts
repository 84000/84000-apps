import {
  BODY_MATTER_FILTER,
  FRONT_MATTER_FILTER,
} from '@eightyfourthousand/data-access';

import { loadStackReaderSeed } from './stack-reader-seed';
import { STACK_SECTIONS } from './stack-seed';

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

const BIBLIOGRAPHY = [
  {
    heading: 'Sources',
    label: '1',
    entries: [{ uuid: 'b1', label: '1.1', html: '<p>One</p>' }],
  },
];

const page = (type: string) => ({
  metas: [{ uuid: `${type}-1`, label: '1', type }],
  nextCursor: `${type}-1`,
  hasMoreAfter: true,
  hasMoreBefore: false,
});

const block = (uuid: string) => ({
  type: 'passage',
  attrs: {
    uuid,
    references: [{ uuid: 'n1' }],
    alignments: { toh1: { tibetan: 'བོད' } },
  },
  content: [{ type: 'paragraph' }],
});

beforeEach(() => {
  api.getPassageMetaPage
    .mockReset()
    .mockImplementation(async ({ type }) => page(type));
  api.getTranslationBlocks
    .mockReset()
    .mockImplementation(async ({ type }) => ({ blocks: [block(`${type}-1`)] }));
  api.getWorkBibliography.mockReset().mockResolvedValue(BIBLIOGRAPHY);
});

describe('loadStackReaderSeed', () => {
  it('reads the bibliography readers see, once, with the build client', async () => {
    const client = {} as never;
    const seed = await loadStackReaderSeed({ client, workUuid: 'w1' });

    expect(api.getWorkBibliography.mock.calls).toEqual([
      [{ client, uuid: 'w1' }],
    ]);
    expect(seed.bibliography).toEqual(BIBLIOGRAPHY);
  });

  it('reads every section, in the order the work reads', async () => {
    const seed = await loadStackReaderSeed({
      client: {} as never,
      workUuid: 'w1',
    });

    expect(seed.workUuid).toBe('w1');
    expect(seed.sections.map(({ tab }) => tab)).toEqual(
      STACK_SECTIONS.map(({ tab }) => tab),
    );
    expect(seed.sections[1].page).toEqual(page(BODY_MATTER_FILTER));
  });

  it('reads content for every section, the right panel’s included', async () => {
    const seed = await loadStackReaderSeed({
      client: {} as never,
      workUuid: 'w1',
    });

    expect(
      api.getTranslationBlocks.mock.calls.map(([args]) => [
        args.type,
        args.maxPassages,
      ]),
    ).toEqual([
      [FRONT_MATTER_FILTER, 40],
      [BODY_MATTER_FILTER, 40],
      ['abbreviations', 40],
      ['endnotes', 40],
    ]);
    const passages = Object.fromEntries(
      seed.sections.map(({ tab, passages }) => [tab, passages.length]),
    );
    expect(passages).toEqual({
      front: 1,
      translation: 1,
      abbreviations: 1,
      endnotes: 1,
    });
  });

  it('keeps a passage’s row data with its content', async () => {
    const seed = await loadStackReaderSeed({
      client: {} as never,
      workUuid: 'w1',
    });

    expect(seed.sections[1].passages[0]).toEqual({
      uuid: `${BODY_MATTER_FILTER}-1`,
      content: [{ type: 'paragraph' }],
      extras: {
        references: [{ uuid: 'n1' }],
        alignments: { toh1: { tibetan: 'བོད' } },
      },
    });
  });

  it('seeds no content for a section whose read failed', async () => {
    api.getTranslationBlocks.mockResolvedValue({ blocks: [], failed: true });

    const seed = await loadStackReaderSeed({
      client: {} as never,
      workUuid: 'w1',
    });

    expect(seed.sections.every(({ passages }) => passages.length === 0)).toBe(
      true,
    );
  });
});
