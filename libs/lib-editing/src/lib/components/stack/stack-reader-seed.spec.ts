import {
  BODY_MATTER_FILTER,
  FRONT_MATTER_FILTER,
} from '@eightyfourthousand/data-access';

import { loadStackReaderSeed } from './stack-reader-seed';
import { STACK_SECTIONS } from './stack-seed';

jest.mock('@eightyfourthousand/client-graphql/ssr', () => ({
  getPassageMetaPage: jest.fn(),
  getTranslationBlocks: jest.fn(),
}));

const api = jest.requireMock('@eightyfourthousand/client-graphql/ssr') as {
  getPassageMetaPage: jest.Mock;
  getTranslationBlocks: jest.Mock;
};

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
});

describe('loadStackReaderSeed', () => {
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

  it('reads content only for the tabs a first render draws', async () => {
    const seed = await loadStackReaderSeed({
      client: {} as never,
      workUuid: 'w1',
    });

    expect(
      api.getTranslationBlocks.mock.calls.map(([args]) => args.type),
    ).toEqual([FRONT_MATTER_FILTER, BODY_MATTER_FILTER]);
    const passages = Object.fromEntries(
      seed.sections.map(({ tab, passages }) => [tab, passages.length]),
    );
    expect(passages).toEqual({
      front: 1,
      translation: 1,
      abbreviations: 0,
      endnotes: 0,
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
