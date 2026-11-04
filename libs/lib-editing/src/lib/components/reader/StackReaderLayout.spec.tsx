import type { ReactElement, ReactNode } from 'react';

import { StackReaderProvider } from '../stack/StackReaderProvider';
import type { StackReaderSeed } from '../stack/stack-seed';
import { ReaderLayout } from './ReaderLayout';
import { StackReaderLayout } from './StackReaderLayout';

jest.mock('@eightyfourthousand/client-graphql/ssr', () => ({
  createBuildGraphQLClient: jest.fn(() => ({ client: 'build' })),
  getTranslationMetadataByUuid: jest.fn(),
}));
jest.mock('../stack/stack-reader-seed', () => ({
  loadStackReaderSeed: jest.fn(),
}));
jest.mock('../stack/StackReaderProvider', () => ({
  StackReaderProvider: () => null,
}));
jest.mock('./ReaderLayout', () => ({ ReaderLayout: () => null }));

const { loadStackReaderSeed } = jest.requireMock(
  '../stack/stack-reader-seed',
) as { loadStackReaderSeed: jest.Mock };
const { getTranslationMetadataByUuid } = jest.requireMock(
  '@eightyfourthousand/client-graphql/ssr',
) as { getTranslationMetadataByUuid: jest.Mock };

const WORK = '1b9d6bcd-bbfd-4b2d-9b5d-ab8dfbbd4bed';
const seed = { workUuid: WORK, sections: [] } as unknown as StackReaderSeed;

const layout = async (slug: string) => {
  const params = Promise.resolve({ slug });
  const element = (await StackReaderLayout({
    params,
    left: 'left',
    main: 'main',
    right: 'right',
    initialToh: 'toh8',
  })) as ReactElement<{
    workUuid?: string;
    seed?: StackReaderSeed;
    params?: Promise<{ slug: string }>;
    children?: ReactElement<Record<string, unknown>>;
  }>;
  return { element, params };
};

beforeEach(() => {
  loadStackReaderSeed.mockReset().mockResolvedValue(seed);
  getTranslationMetadataByUuid
    .mockReset()
    .mockResolvedValue({ uuid: WORK, publicationStatus: '1.0' });
});

describe('StackReaderLayout', () => {
  it('reads the work on the server and holds it over every panel', async () => {
    const { element, params } = await layout(WORK);

    expect(loadStackReaderSeed).toHaveBeenCalledWith({
      client: { client: 'build' },
      workUuid: WORK,
    });
    expect(element.type).toBe(StackReaderProvider);
    expect(element.props.workUuid).toBe(WORK);
    expect(element.props.seed).toBe(seed);

    const inner = element.props.children as ReactElement<{
      params: Promise<{ slug: string }>;
      left: ReactNode;
      main: ReactNode;
      right: ReactNode;
      initialToh: string;
    }>;
    expect(inner.type).toBe(ReaderLayout);
    expect(inner.props).toEqual({
      params,
      left: 'left',
      main: 'main',
      right: 'right',
      initialToh: 'toh8',
    });
  });

  it.each([
    ['an unpublished work', { uuid: WORK, publicationStatus: '2.a' }],
    ['a work whose metadata cannot be read', null],
  ])('seeds and provides nothing for %s', async (_, metadata) => {
    getTranslationMetadataByUuid.mockResolvedValue(metadata);
    const { element, params } = await layout(WORK);

    expect(getTranslationMetadataByUuid).toHaveBeenCalledWith({
      client: { client: 'build' },
      uuid: WORK,
    });
    expect(loadStackReaderSeed).not.toHaveBeenCalled();
    expect(element.type).toBe(ReaderLayout);
    expect(element.props.params).toBe(params);
  });

  it('reads nothing for a slug that is not a uuid', async () => {
    const { element } = await layout('toh8');

    expect(loadStackReaderSeed).not.toHaveBeenCalled();
    expect(element.type).toBe(ReaderLayout);
  });
});
