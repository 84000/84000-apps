import type { ReactElement } from 'react';

import type { StackReaderSeed } from '../stack/stack-seed';
import { StackReaderBodyPage } from './StackReaderBodyPage';

jest.mock('@eightyfourthousand/client-graphql/ssr', () => ({
  BODY_MATTER_FILTER: 'body',
  createBuildGraphQLClient: jest.fn(() => ({})),
  getTranslationBlocks: jest.fn(async () => ({
    blocks: [
      {
        type: 'passage',
        attrs: { uuid: 'p0', alignments: { a: 'b' } },
        content: [{ type: 'paragraph' }],
      },
      { type: 'passage', attrs: { uuid: 'p1' } },
    ],
  })),
  getTranslationTitles: jest.fn(async () => [{ uuid: 't1' }]),
  getTranslationMetadataByUuid: jest.fn(async () => ({
    publicationStatus: '1',
  })),
}));
jest.mock('../stack/stack-reader-seed', () => ({
  loadStackReaderSeed: jest.fn(),
}));
jest.mock('../stack/StackReaderProvider', () => ({
  StackReaderProvider: () => null,
}));
jest.mock('./StackReaderBodyPanel', () => ({
  StackReaderBodyPanel: () => null,
}));
jest.mock('next/navigation', () => ({
  notFound: jest.fn(() => 'not-found'),
}));

const { loadStackReaderSeed } = jest.requireMock(
  '../stack/stack-reader-seed',
) as { loadStackReaderSeed: jest.Mock };
const { getTranslationBlocks } = jest.requireMock(
  '@eightyfourthousand/client-graphql/ssr',
) as { getTranslationBlocks: jest.Mock };

const WORK = '1b9d6bcd-bbfd-4b2d-9b5d-ab8dfbbd4bed';

const seed: StackReaderSeed = {
  workUuid: WORK,
  sections: [
    { tab: 'front', page: { metas: [] }, passages: [] },
    {
      tab: 'translation',
      page: { metas: [] },
      passages: [{ uuid: 'p0', content: [] }],
    },
  ],
} as unknown as StackReaderSeed;

const page = async (slug: string) =>
  (await StackReaderBodyPage({
    params: Promise.resolve({ slug }),
  })) as ReactElement<{
    workUuid: string;
    seed: StackReaderSeed;
    children: ReactElement<{ body: unknown; isPublished?: boolean }>;
  }>;

beforeEach(() => loadStackReaderSeed.mockReset().mockResolvedValue(seed));

describe('StackReaderBodyPage', () => {
  it('hands the server-read seed to the stack provider', async () => {
    const element = await page(WORK);

    expect(loadStackReaderSeed).toHaveBeenCalledWith(
      expect.objectContaining({ workUuid: WORK }),
    );
    expect(element.props.workUuid).toBe(WORK);
    expect(element.props.seed).toBe(seed);
  });

  it('gives the panel the first 250 passages, with their alignments', async () => {
    const panel = (await page(WORK)).props.children;

    expect(getTranslationBlocks).toHaveBeenCalledWith(
      expect.objectContaining({
        uuid: WORK,
        type: 'body',
        maxPassages: 250,
      }),
    );

    expect(panel.props.body).toEqual([
      { type: 'passage', attrs: { uuid: 'p0', alignments: { a: 'b' } } },
      { type: 'passage', attrs: { uuid: 'p1', alignments: {} } },
    ]);
    expect(panel.props.isPublished).toBe(true);
  });

  it('reads nothing for a slug that is not a uuid', async () => {
    expect(
      await StackReaderBodyPage({ params: Promise.resolve({ slug: 'toh1' }) }),
    ).toBe('not-found');
    expect(loadStackReaderSeed).not.toHaveBeenCalled();
  });
});
