/**
 * Acceptance tests for DEV-844: the `search-translation` MCP tool caps its
 * output, reports what it left out, and takes a published/draft source.
 *
 * Written from the spec only. They assert behaviour (a bounded output, a
 * truthful omitted-count notice, no silent emptying, source threading), not
 * exact wording or exact cap numbers.
 */
import type { DataClient } from '@eightyfourthousand/data-access';
import { searchWithClient } from '@eightyfourthousand/lib-search';
import { createSearchTranslationTool } from './search-translation';
import { createReadTools } from './index';

jest.mock('@eightyfourthousand/lib-search', () => ({
  searchWithClient: jest.fn(),
}));
const mockedSearch = jest.mocked(searchWithClient);

// Importing the read-tools index pulls in tools that depend on the ssr
// entrypoint of data-access, which loads next/server (needs a Request global
// that jest's node env lacks). Those tools are not under test here.
jest.mock('@eightyfourthousand/data-access/ssr', () => ({}));

// The spec's hard ceiling for the tool's text output.
const OUTPUT_CEILING = 25_000;

type AnyRecord = Record<string, any>;

const english = (n: number) => `English passage ${n}. `.padEnd(10_000, 'e');
const tibetan = (n: number) => `བོད་ཡིག ${n} `.padEnd(9_000, 'ཀ');

const makeAlignments = (count: number): AnyRecord[] =>
  Array.from({ length: count }, (_, i) => ({
    type: 'alignment',
    section: 'translation',
    uuid: `align-${i}`,
    label: `1.${i}`,
    content: english(i),
    source: tibetan(i),
    volume: '1',
    folio: `${i}.a`,
  }));

const makePassages = (count: number, size = 6_000): AnyRecord[] =>
  Array.from({ length: count }, (_, i) => ({
    type: 'passage',
    section: 'introduction',
    uuid: `passage-${i}`,
    label: `i.${i}`,
    content: `Passage ${i} `.padEnd(size, 'p'),
  }));

const makeSimple = (type: string, count: number, size = 6_000): AnyRecord[] =>
  Array.from({ length: count }, (_, i) => ({
    type,
    uuid: `${type}-${i}`,
    content: `${type} ${i} `.padEnd(size, 'x'),
  }));

const results = (partial: Partial<Record<string, AnyRecord[]>>): any => ({
  passages: [],
  alignments: [],
  bibliographies: [],
  glossaries: [],
  ...partial,
});

const KINDS = ['passages', 'alignments', 'bibliographies', 'glossaries'];

describe('search-translation tool (DEV-844 acceptance)', () => {
  const client = {} as DataClient;
  const extra = {} as any;
  const input = { text: 'dharma', uuid: 'work-1', toh: '1' };

  const run = async (
    searchResults: unknown,
    tool = createSearchTranslationTool(client),
  ) => {
    mockedSearch.mockResolvedValue(searchResults as any);
    const result = await tool.handler(input, extra);
    expect(result.isError).toBeFalsy();
    expect(result.content[0].type).toBe('text');
    const text = (result.content[0] as { text: string }).text;
    return { text, json: JSON.parse(text) as AnyRecord };
  };

  beforeEach(() => jest.clearAllMocks());

  describe('output cap (criterion 1)', () => {
    it('keeps a huge mixed-kind result under the cap', async () => {
      const huge = results({
        passages: makePassages(60),
        alignments: makeAlignments(200),
        bibliographies: makeSimple('bibliography', 50),
        glossaries: makeSimple('glossary', 50),
      });
      const { text, json } = await run(huge);
      expect(text.length).toBeLessThan(OUTPUT_CEILING);
      // Output is still the four-array shape.
      for (const kind of KINDS) expect(Array.isArray(json[kind])).toBe(true);
    });
  });

  describe('truncation notice (criterion 2)', () => {
    it('notices omission when only a non-alignment kind overflows', async () => {
      const { text, json } = await run(
        results({ passages: makePassages(300) }),
      );
      expect(json.truncated).toBeDefined();
      expect(json.truncated.totals).toMatchObject({ passages: 300 });
      expect(json.truncated.notice).toContain('work-grep');
      expect(text.length).toBeLessThan(OUTPUT_CEILING);
    });
  });

  describe('small results are unchanged (criterion 4)', () => {
    it('returns an empty result set unchanged', async () => {
      const empty = results({});
      const { json } = await run(empty);
      expect(json).toEqual(empty);
    });
  });

  describe('source (criterion 6)', () => {
    describe('createReadTools threading', () => {
      const findSearch = (tools: ReturnType<typeof createReadTools>) => {
        const tool = tools.find((t) => t.name === 'search-translation');
        expect(tool).toBeDefined();
        return tool!;
      };

      it('threads searchTranslationSource: draft to search-translation', async () => {
        const tool = findSearch(
          createReadTools(client, { searchTranslationSource: 'draft' }),
        );
        mockedSearch.mockResolvedValue(results({}));
        await tool.handler(input, extra);
        expect(mockedSearch).toHaveBeenCalledWith(
          expect.objectContaining({ source: 'draft' }),
        );
      });
    });
  });
});
