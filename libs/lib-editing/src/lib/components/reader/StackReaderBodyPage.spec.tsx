import type { ReactElement } from 'react';

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
jest.mock('./StackReaderBodyPanel', () => ({
  StackReaderBodyPanel: () => null,
}));
jest.mock('next/navigation', () => ({
  notFound: jest.fn(() => 'not-found'),
}));

const { getTranslationBlocks } = jest.requireMock(
  '@eightyfourthousand/client-graphql/ssr',
) as { getTranslationBlocks: jest.Mock };

const WORK = '1b9d6bcd-bbfd-4b2d-9b5d-ab8dfbbd4bed';

const page = async (slug: string) =>
  (await StackReaderBodyPage({
    params: Promise.resolve({ slug }),
  })) as ReactElement<{ body: unknown; isPublished?: boolean }>;

beforeEach(() => getTranslationBlocks.mockClear());

describe('StackReaderBodyPage', () => {
  it('gives the panel the first 250 passages, with their alignments', async () => {
    const panel = await page(WORK);

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
    expect(getTranslationBlocks).not.toHaveBeenCalled();
  });
});
