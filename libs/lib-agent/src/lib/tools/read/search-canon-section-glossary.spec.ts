import { createSearchCanonSectionGlossaryTool } from './search-canon-section-glossary';
import type { DataClient } from '@eightyfourthousand/data-access';

import { searchCanonSectionGlossaryTerms } from '@eightyfourthousand/data-access';

jest.mock('@eightyfourthousand/data-access', () => ({
  CONTENT_SOURCES: ['draft', 'published'],
  searchCanonSectionGlossaryTerms: jest.fn(),
}));

const mockedSearch = jest.mocked(searchCanonSectionGlossaryTerms);

describe('search-canon-section-glossary tool', () => {
  const client = {} as DataClient;
  const tool = createSearchCanonSectionGlossaryTool(client);
  const extra = {} as Parameters<typeof tool.handler>[1];

  const grouped = [
    {
      work: { uuid: 'work-1', title: 'Toh 543', toh: ['toh543'] },
      terms: [{ uuid: 'g1', headword: 'las' }],
    },
  ];

  beforeEach(() => jest.clearAllMocks());

  it('has correct metadata', () => {
    expect(tool.name).toBe('search-canon-section-glossary');
    expect(tool.annotations?.readOnlyHint).toBe(true);
  });

  it('passes every option through and returns the grouped results', async () => {
    mockedSearch.mockResolvedValue(grouped as any);

    const result = await tool.handler(
      {
        sectionUuid: '11111111-1111-1111-1111-111111111111',
        query: 'karman',
        includeDescendants: false,
        limit: 25,
        withAttestations: true,
        source: 'draft',
      },
      extra,
    );

    expect(mockedSearch).toHaveBeenCalledWith({
      client,
      sectionUuid: '11111111-1111-1111-1111-111111111111',
      query: 'karman',
      includeDescendants: false,
      limit: 25,
      withAttestations: true,
      source: 'draft',
    });
    expect(JSON.parse((result.content[0] as { text: string }).text)).toEqual(
      grouped,
    );
  });

  it('leaves the source unset so data-access applies the published default', async () => {
    mockedSearch.mockResolvedValue([]);

    await tool.handler(
      {
        sectionUuid: '11111111-1111-1111-1111-111111111111',
        query: 'karman',
      },
      extra,
    );

    expect(mockedSearch).toHaveBeenCalledWith(
      expect.objectContaining({ source: undefined }),
    );
  });

  it('reports a term absent from the section as an empty list, not an error', async () => {
    mockedSearch.mockResolvedValue([]);

    const result = await tool.handler(
      {
        sectionUuid: '11111111-1111-1111-1111-111111111111',
        query: 'nonexistent',
      },
      extra,
    );

    expect(result.isError).toBeUndefined();
    expect(JSON.parse((result.content[0] as { text: string }).text)).toEqual(
      [],
    );
  });
});
