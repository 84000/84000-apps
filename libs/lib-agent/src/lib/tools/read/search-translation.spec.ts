import {
  capSearchResults,
  createSearchTranslationTool,
  snippetAround,
  SEARCH_TRANSLATION_MAX_CHARS,
  SEARCH_TRANSLATION_MAX_RESULTS,
  SEARCH_TRANSLATION_SNIPPET_CHARS,
} from './search-translation';
import type { DataClient } from '@eightyfourthousand/data-access';

import {
  searchWithClient,
  type AlignmentMatch,
  type SearchResults,
} from '@eightyfourthousand/lib-search';

jest.mock('@eightyfourthousand/lib-search', () => ({
  searchWithClient: jest.fn(),
}));
const mockedSearch = jest.mocked(searchWithClient);

const alignment = (
  i: number,
  english: string,
  tibetan = 'བོད།',
): AlignmentMatch => ({
  type: 'alignment',
  section: 'translation',
  uuid: `a${i}`,
  label: `1.${i}`,
  content: english,
  source: tibetan,
  volume: '34',
  folio: `${i}.a`,
});

const empty = (): SearchResults => ({
  alignments: [],
  passages: [],
  bibliographies: [],
  glossaries: [],
});

const parse = (result: { content: { type: string; text?: string }[] }) =>
  JSON.parse((result.content[0] as { text: string }).text);

describe('search-translation tool', () => {
  const client = {} as DataClient;
  const tool = createSearchTranslationTool(client);
  const extra = {} as Parameters<typeof tool.handler>[1];

  beforeEach(() => jest.clearAllMocks());

  it('has correct metadata', () => {
    expect(tool.name).toBe('search-translation');
    expect(tool.annotations?.readOnlyHint).toBe(true);
    expect(Object.keys(tool.inputSchema ?? {})).toEqual([
      'text',
      'uuid',
      'toh',
      'useRegex',
    ]);
  });

  it('says translation-body hits come back under alignments', () => {
    expect(tool.description).toMatch(
      /translation body come back under `alignments`/,
    );
  });

  it('searches the published copy by default', async () => {
    mockedSearch.mockResolvedValue(empty());
    await tool.handler({ text: 'dharma', uuid: 'work-1', toh: '1' }, extra);
    expect(mockedSearch).toHaveBeenCalledWith({
      client,
      text: 'dharma',
      uuid: 'work-1',
      toh: '1',
      useRegex: undefined,
      source: 'published',
    });
    expect(tool.description).toMatch(/published snapshot/);
  });

  it('searches the draft when built with source draft', async () => {
    const draft = createSearchTranslationTool(client, { source: 'draft' });
    mockedSearch.mockResolvedValue(empty());
    await draft.handler({ text: 'dharma', uuid: 'work-1', toh: '1' }, extra);
    expect(mockedSearch).toHaveBeenCalledWith(
      expect.objectContaining({ source: 'draft' }),
    );
    expect(draft.description).toMatch(/draft/);
  });

  it('returns small results unchanged, with no truncation note', async () => {
    const results = { ...empty(), alignments: [alignment(1, 'the dharma')] };
    mockedSearch.mockResolvedValue(results);

    const result = await tool.handler(
      { text: 'dharma', uuid: 'work-1', toh: '1' },
      extra,
    );

    expect(result.content[0]).toEqual({
      type: 'text',
      text: JSON.stringify(results, null, 2),
    });
  });

  it('caps a large result and says how many more there are', async () => {
    const long = `${'x'.repeat(5000)} Gaṅgā ${'y'.repeat(5000)}`;
    const results = {
      ...empty(),
      alignments: Array.from({ length: 375 }, (_, i) =>
        alignment(i, long, 'ག'.repeat(9000)),
      ),
      passages: [
        {
          type: 'passage' as const,
          uuid: 'p1',
          section: 'introduction',
          label: 'i.1',
          content: 'the Gaṅgā river',
        },
      ],
    };
    mockedSearch.mockResolvedValue(results);

    const result = await tool.handler(
      { text: 'Ganga', uuid: 'work-1', toh: '8' },
      extra,
    );
    const text = (result.content[0] as { text: string }).text;
    const body = parse(result);

    expect(text.length).toBeLessThan(25_000);
    expect(body.passages).toHaveLength(1);
    expect(body.alignments.length).toBeGreaterThan(0);
    const shown = body.alignments.length + body.passages.length;
    expect(shown).toBeLessThanOrEqual(SEARCH_TRANSLATION_MAX_RESULTS);
    expect(body.truncated.totals).toEqual({
      alignments: 375,
      passages: 1,
      bibliographies: 0,
      glossaries: 0,
    });
    expect(body.truncated.omitted).toBe(376 - shown);
    expect(body.truncated.notice).toContain(`${376 - shown} more results`);
    expect(body.truncated.notice).toContain('work-grep');
    expect(body.alignments[0].content).toContain('Gaṅgā');
    expect(body.alignments[0].content.length).toBeLessThanOrEqual(
      SEARCH_TRANSLATION_SNIPPET_CHARS + 2,
    );
  });

  it('returns error when search fails', async () => {
    mockedSearch.mockResolvedValue(undefined);

    const result = await tool.handler(
      { text: 'dharma', uuid: 'work-1', toh: '1' },
      extra,
    );

    expect(result.isError).toBe(true);
  });
});

describe('capSearchResults', () => {
  it('always keeps at least one result', () => {
    const huge = 'z'.repeat(SEARCH_TRANSLATION_MAX_CHARS * 2);
    const capped = capSearchResults(
      {
        ...empty(),
        glossaries: [
          {
            type: 'glossary',
            uuid: 'g1',
            content: 'x',
            entry: { definition: huge },
          } as never,
        ],
      },
      { text: 'x' },
    );
    expect(capped.glossaries).toHaveLength(1);
  });

  it('takes results from each kind in turn', () => {
    const capped = capSearchResults(
      {
        ...empty(),
        alignments: Array.from({ length: 50 }, (_, i) => alignment(i, 'om')),
        glossaries: [{ type: 'glossary', uuid: 'g1', content: 'om' }],
      },
      { text: 'om' },
    );
    expect(capped.glossaries).toHaveLength(1);
    expect(capped.alignments).toHaveLength(SEARCH_TRANSLATION_MAX_RESULTS - 1);
    expect(capped.truncated?.omitted).toBe(
      50 + 1 - SEARCH_TRANSLATION_MAX_RESULTS,
    );
  });

  it('notes trimmed snippets even when nothing is omitted', () => {
    const capped = capSearchResults(
      { ...empty(), alignments: [alignment(1, `${'a'.repeat(1000)} om`)] },
      { text: 'om' },
    );
    expect(capped.truncated?.omitted).toBe(0);
    expect(capped.truncated?.snippets).toBe(true);
    expect(capped.truncated?.notice).toContain('get-passage');
  });
});

describe('snippetAround', () => {
  const find = (folded: string) => folded.toLowerCase().indexOf('manjusri');

  it('leaves short text alone', () => {
    expect(snippetAround('short', find)).toBe('short');
  });

  it('centres on a diacritic-folded match', () => {
    const value = `${'a'.repeat(2000)} Mañjuśrī ${'b'.repeat(2000)}`;
    const cut = snippetAround(value, find, 100);
    expect(cut).toContain('Mañjuśrī');
    expect(cut.startsWith('…')).toBe(true);
    expect(cut.endsWith('…')).toBe(true);
  });

  it('falls back to the start when no match is found', () => {
    const value = 'c'.repeat(500);
    expect(snippetAround(value, () => -1, 100)).toBe(`${'c'.repeat(100)}…`);
  });
});
