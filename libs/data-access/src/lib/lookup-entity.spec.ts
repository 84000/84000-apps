import { lookupEntity } from './lookup-entity';
import { getGlossaryInstance } from './glossary';
import { getFolioLocation } from './folio';

jest.mock('./client-ssr', () => ({
  createServerClient: jest.fn().mockResolvedValue({}),
}));

jest.mock('./bibliography', () => ({
  getBibliographyEntry: jest.fn(),
}));

jest.mock('./folio', () => ({
  getFolioLocation: jest.fn(),
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
const mockedGetFolioLocation = jest.mocked(getFolioLocation);

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

    const result = await lookupEntity({
      type: 'glossary',
      entity: 'glossary-uuid',
    });

    expect(result.path).toBe(
      '/work-uuid?right=open%3Aglossary%3Aglossary-uuid',
    );

    expect(mockedGetGlossaryInstance).toHaveBeenCalledWith({
      client: {},
      uuid: 'glossary-uuid',
    });
  });

  it('routes folio entities to the source tab in the main panel', async () => {
    mockedGetFolioLocation.mockResolvedValue({
      workUuid: 'work-uuid',
      folioUuid: 'folio-uuid',
      toh: 'toh1',
    });

    const result = await lookupEntity({
      type: 'folio',
      entity: 'folio-uuid',
    });

    expect(result.path).toBe(
      '/work-uuid?main=open%3Asource%3Afolio-uuid&toh=toh1',
    );

    expect(mockedGetFolioLocation).toHaveBeenCalledWith({
      client: {},
      uuid: 'folio-uuid',
    });
  });
});
