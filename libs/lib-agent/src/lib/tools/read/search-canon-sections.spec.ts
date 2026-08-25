import { createSearchCanonSectionsTool } from './search-canon-sections';
import type { DataClient } from '@eightyfourthousand/data-access';

import { searchCanonSections } from '@eightyfourthousand/data-access';

jest.mock('@eightyfourthousand/data-access', () => ({
  searchCanonSections: jest.fn(),
}));

const mockedSearch = jest.mocked(searchCanonSections);

describe('search-canon-sections tool', () => {
  const client = {} as DataClient;
  const tool = createSearchCanonSectionsTool(client);
  const extra = {} as Parameters<typeof tool.handler>[1];

  const section = {
    uuid: 'section-1',
    label: 'Action Tantras',
    parentLabel: 'The Kangyur',
    tohRange: 'Toh 502–808',
    hasChildren: false,
    directWorkCount: 307,
    descendantWorkCount: 307,
  };

  beforeEach(() => jest.clearAllMocks());

  it('has correct metadata', () => {
    expect(tool.name).toBe('search-canon-sections');
    expect(tool.annotations?.readOnlyHint).toBe(true);
  });

  it('passes the query and limit through and returns the sections', async () => {
    mockedSearch.mockResolvedValue([section] as any);

    const result = await tool.handler(
      { query: 'action tantra', limit: 5 },
      extra,
    );

    expect(mockedSearch).toHaveBeenCalledWith({
      client,
      query: 'action tantra',
      limit: 5,
    });
    expect(JSON.parse((result.content[0] as { text: string }).text)).toEqual([
      section,
    ]);
  });

  it('returns every match rather than resolving ambiguity itself', async () => {
    const tengyur = {
      ...section,
      uuid: 'section-2',
      label: 'Action Tantra Treatises',
      parentLabel: 'The Tengyur',
      tohRange: 'Toh 2670–3139',
    };
    mockedSearch.mockResolvedValue([section, tengyur] as any);

    const result = await tool.handler({ query: 'action tantra' }, extra);
    const sections = JSON.parse((result.content[0] as { text: string }).text);

    expect(sections).toHaveLength(2);
    expect(result.isError).toBeUndefined();
  });

  it('reports no matches as an empty list, not an error', async () => {
    mockedSearch.mockResolvedValue([]);

    const result = await tool.handler({ query: 'nonexistent' }, extra);

    expect(result.isError).toBeUndefined();
    expect(JSON.parse((result.content[0] as { text: string }).text)).toEqual(
      [],
    );
  });
});
