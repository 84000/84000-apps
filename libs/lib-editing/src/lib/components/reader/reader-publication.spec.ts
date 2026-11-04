import { isReaderPublished } from './reader-publication';

jest.mock('@eightyfourthousand/client-graphql/ssr', () => ({
  getTranslationMetadataByUuid: jest.fn(),
}));

const { getTranslationMetadataByUuid } = jest.requireMock(
  '@eightyfourthousand/client-graphql/ssr',
) as { getTranslationMetadataByUuid: jest.Mock };

const client = { client: 'build' } as never;

describe('isReaderPublished', () => {
  it.each([
    ['a published work', { publicationStatus: '1' }, true],
    ['a published revision', { publicationStatus: '1.2' }, true],
    ['a work in progress', { publicationStatus: '2.a' }, false],
    ['a work with no status', { publicationStatus: null }, false],
    ['a work whose metadata cannot be read', null, false],
  ])('is %s: %p', async (_, metadata, expected) => {
    getTranslationMetadataByUuid.mockResolvedValueOnce(metadata);

    await expect(isReaderPublished({ client, uuid: 'w1' })).resolves.toBe(
      expected,
    );
    expect(getTranslationMetadataByUuid).toHaveBeenLastCalledWith({
      client,
      uuid: 'w1',
    });
  });
});
