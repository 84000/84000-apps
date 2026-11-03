import { lookupEntity } from './lookup-entity';
import { getGlossaryInstance } from './glossary';
import { getFolioLocation } from './folio';
import { getBibliographyEntry } from './bibliography';
import { getPassageByUuidOrXmlId } from './passage';
import { getTranslationMetadataByToh } from './publications';

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
  getPassageByUuidOrXmlId: jest.fn(),
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
const mockedGetBibliographyEntry = jest.mocked(getBibliographyEntry);
const mockedGetPassageByUuidOrXmlId = jest.mocked(getPassageByUuidOrXmlId);
const mockedGetTranslationMetadataByToh = jest.mocked(
  getTranslationMetadataByToh,
);

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

  it('looks versioned entities up in the requested content source', async () => {
    mockedGetBibliographyEntry.mockResolvedValue({
      uuid: 'bibl-uuid',
      workUuid: 'work-uuid',
    } as Awaited<ReturnType<typeof getBibliographyEntry>>);

    const result = await lookupEntity({
      type: 'bibliography',
      entity: 'bibl-uuid',
      source: 'draft',
    });

    expect(result.path).toBe(
      '/work-uuid?right=open%3Abibliography%3Abibl-uuid',
    );
    expect(mockedGetBibliographyEntry).toHaveBeenCalledWith({
      client: {},
      uuid: 'bibl-uuid',
      source: 'draft',
    });
  });

  it('routes a translation xmlId to its passage in the work', async () => {
    mockedGetPassageByUuidOrXmlId.mockResolvedValue({
      uuid: 'passage-uuid',
      workUuid: 'work-uuid',
      content: '',
      label: '1.1',
      sort: 1,
      type: 'translation',
      toh: 'toh1',
      xmlId: 'UT22084-001-001-1',
    });

    const result = await lookupEntity({
      type: 'translation',
      entity: 'toh1.html',
      xmlId: 'UT22084-001-001-1',
    });

    expect(result).toMatchObject({
      path: '/work-uuid?toh=toh1&main=open%3Atranslation%3Apassage-uuid',
      uuid: 'passage-uuid',
      workUuid: 'work-uuid',
    });
    expect(mockedGetPassageByUuidOrXmlId).toHaveBeenCalledWith({
      client: {},
      xmlId: 'UT22084-001-001-1',
    });
    expect(mockedGetTranslationMetadataByToh).not.toHaveBeenCalled();
  });

  it('falls back to the work when a translation xmlId is unknown', async () => {
    mockedGetPassageByUuidOrXmlId.mockResolvedValue(null);
    mockedGetTranslationMetadataByToh.mockResolvedValue({
      uuid: 'work-uuid',
    } as Awaited<ReturnType<typeof getTranslationMetadataByToh>>);

    const result = await lookupEntity({
      type: 'translation',
      entity: 'toh1',
      xmlId: 'missing',
    });

    expect(result.path).toBe('/work-uuid?toh=toh1');
  });
});
