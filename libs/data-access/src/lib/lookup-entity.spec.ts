import { lookupEntity } from './lookup-entity';
import { getGlossaryInstance } from './glossary';

jest.mock('./client-ssr', () => ({
  createServerClient: jest.fn().mockResolvedValue({}),
}));

jest.mock('./bibliography', () => ({
  getBibliographyEntry: jest.fn(),
}));

jest.mock('./passage', () => ({
  getPassage: jest.fn(),
  getPassageUuidByXmlId: jest.fn(),
}));

jest.mock('./publications', () => ({
  getTranslationMetadataByToh: jest.fn(),
  getTranslationMetadataByUuid: jest.fn(),
}));

jest.mock('./glossary', () => ({
  getGlossaryInstance: jest.fn(),
}));

const mockedGetGlossaryInstance = jest.mocked(getGlossaryInstance);

describe('lookupEntity', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('routes glossary entities using the glossary UUID in the panel hash', async () => {
    mockedGetGlossaryInstance.mockResolvedValue({
      uuid: 'glossary-uuid',
      authority: 'authority-uuid',
      workUuid: 'work-uuid',
      definition: null,
      termNumber: 1,
      names: {},
    });

    await expect(
      lookupEntity({
        type: 'glossary',
        entity: 'glossary-uuid',
      }),
    ).resolves.toBe('/work-uuid?right=open%3Aglossary%3Aglossary-uuid');

    expect(mockedGetGlossaryInstance).toHaveBeenCalledWith({
      client: {},
      uuid: 'glossary-uuid',
    });
  });
});
