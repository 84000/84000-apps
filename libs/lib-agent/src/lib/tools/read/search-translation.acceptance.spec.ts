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

  const shown = (json: AnyRecord) =>
    KINDS.reduce((n, k) => n + (json[k]?.length ?? 0), 0);

  beforeEach(() => jest.clearAllMocks());

  describe('metadata and input contract (criterion 7)', () => {
    it('keeps the tool name and read-only annotation', () => {
      const tool = createSearchTranslationTool(client);
      expect(tool.name).toBe('search-translation');
      expect(tool.annotations?.readOnlyHint).toBe(true);
    });

    it('keeps the input keys text, uuid, toh and useRegex', () => {
      const tool = createSearchTranslationTool(client);
      expect(Object.keys(tool.inputSchema).sort()).toEqual(
        ['text', 'toh', 'useRegex', 'uuid'].sort(),
      );
    });

    it('passes the input through to searchWithClient', async () => {
      const tool = createSearchTranslationTool(client);
      mockedSearch.mockResolvedValue(results({}));
      await tool.handler(
        { text: 'a.*b', uuid: 'work-9', toh: '42', useRegex: true },
        extra,
      );
      expect(mockedSearch).toHaveBeenCalledWith(
        expect.objectContaining({
          client,
          text: 'a.*b',
          uuid: 'work-9',
          toh: '42',
          useRegex: true,
        }),
      );
    });

    it('still returns an error when the search returns nothing', async () => {
      const tool = createSearchTranslationTool(client);
      mockedSearch.mockResolvedValue(undefined);
      const result = await tool.handler(input, extra);
      expect(result.isError).toBe(true);
    });
  });

  describe('description (criterion 5)', () => {
    it('says translation-body hits come back under `alignments`', () => {
      const { description } = createSearchTranslationTool(client);
      expect(description).toMatch(/alignments/i);
      // The body of the translation is what lands under alignments; the old
      // description only listed the field names in passing.
      expect(description).toMatch(/body/i);
    });
  });

  describe('output cap (criterion 1)', () => {
    it('keeps a huge alignment-only result well under 25,000 chars', async () => {
      const huge = results({ alignments: makeAlignments(375) });
      // Sanity: the fixture really is huge.
      expect(JSON.stringify(huge, null, 2).length).toBeGreaterThan(5_000_000);

      const { text } = await run(huge);
      expect(text.length).toBeLessThan(OUTPUT_CEILING);
    });

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

    it('keeps a huge passages-only result under the cap', async () => {
      const { text } = await run(results({ passages: makePassages(300) }));
      expect(text.length).toBeLessThan(OUTPUT_CEILING);
    });

    it('only returns results that were in the search output', async () => {
      const alignments = makeAlignments(375);
      const { json } = await run(results({ alignments }));
      const known = new Set(alignments.map((a) => a.uuid));
      expect(json.alignments.length).toBeGreaterThan(0);
      for (const a of json.alignments) expect(known.has(a.uuid)).toBe(true);
    });
  });

  describe('truncation notice (criterion 2)', () => {
    it('says how many more results there are, correctly', async () => {
      const total = 375;
      const { json } = await run(
        results({ alignments: makeAlignments(total) }),
      );

      expect(json.truncated).toBeDefined();
      expect(typeof json.truncated.notice).toBe('string');

      const shownCount = json.alignments.length;
      expect(shownCount).toBeGreaterThan(0);
      expect(shownCount).toBeLessThan(total);

      const omitted = total - shownCount;
      // "N more results"-style: the correct N appears in the notice.
      expect(json.truncated.notice).toMatch(
        new RegExp(`(^|[^\\d,.])${omitted}([^\\d]|$)`),
      );
      expect(json.truncated.notice).toMatch(/more/i);
    });

    it('points the reader at work-grep', async () => {
      const { text, json } = await run(
        results({ alignments: makeAlignments(375) }),
      );
      expect(json.truncated.notice).toContain('work-grep');
      expect(text).toContain('work-grep');
    });

    it('reports per-kind totals from before the cap', async () => {
      const { json } = await run(
        results({
          passages: makePassages(40),
          alignments: makeAlignments(375),
          bibliographies: makeSimple('bibliography', 30),
          glossaries: makeSimple('glossary', 25),
        }),
      );
      expect(json.truncated.totals).toMatchObject({
        passages: 40,
        alignments: 375,
        bibliographies: 30,
        glossaries: 25,
      });
    });

    it('reports omitted counts consistent with what is shown', async () => {
      const total = 375;
      const { json } = await run(
        results({ alignments: makeAlignments(total) }),
      );
      const { omitted } = json.truncated;
      expect(omitted).toBeDefined();

      const omittedForAlignments =
        typeof omitted === 'number' ? omitted : omitted.alignments;
      expect(omittedForAlignments).toBe(total - json.alignments.length);
    });

    it('accounts for every match: shown plus omitted equals the totals', async () => {
      const input = results({
        passages: makePassages(40),
        alignments: makeAlignments(120),
        bibliographies: makeSimple('bibliography', 30),
        glossaries: makeSimple('glossary', 25),
      });
      const { json } = await run(input);
      const { omitted, totals } = json.truncated;

      if (typeof omitted === 'number') {
        const totalCount = Object.values(totals as AnyRecord).reduce(
          (a: number, b) => a + (b as number),
          0,
        );
        expect(shown(json) + omitted).toBe(totalCount);
      } else {
        for (const kind of KINDS) {
          expect((json[kind].length as number) + (omitted[kind] ?? 0)).toBe(
            totals[kind],
          );
        }
      }
    });

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

  describe('never silently emptied (criterion 3)', () => {
    it('returns at least one result when a single alignment is enormous', async () => {
      const one = makeAlignments(1);
      one[0].content = 'e'.repeat(200_000);
      one[0].source = 'ཀ'.repeat(200_000);
      const { json } = await run(results({ alignments: one }));
      expect(json.alignments.length).toBeGreaterThanOrEqual(1);
    });

    it('returns at least one result when every result is individually over the cap', async () => {
      const big = results({
        passages: makePassages(3, 40_000),
        alignments: makeAlignments(3).map((a) => ({
          ...a,
          content: 'e'.repeat(50_000),
        })),
      });
      const { json } = await run(big);
      expect(shown(json)).toBeGreaterThanOrEqual(1);
    });

    it('returns at least one result when the only match is in a minor kind', async () => {
      const { json } = await run(
        results({ glossaries: makeSimple('glossary', 1, 100_000) }),
      );
      expect(shown(json)).toBeGreaterThanOrEqual(1);
    });

    it('returns at least one result for a huge multi-kind set', async () => {
      const { json } = await run(
        results({
          passages: makePassages(100, 30_000),
          alignments: makeAlignments(375),
          bibliographies: makeSimple('bibliography', 100, 30_000),
          glossaries: makeSimple('glossary', 100, 30_000),
        }),
      );
      expect(shown(json)).toBeGreaterThanOrEqual(1);
    });

    it('does not claim truncation when nothing matched', async () => {
      const { json } = await run(results({}));
      expect(shown(json)).toBe(0);
      expect(json.truncated).toBeUndefined();
    });
  });

  describe('small results are unchanged (criterion 4)', () => {
    it('returns a small result set verbatim, with no truncated object', async () => {
      const small = results({
        passages: [
          {
            type: 'passage',
            section: 'body',
            uuid: 'p1',
            label: '1.1',
            content: 'dharma',
          },
        ],
        alignments: [
          {
            type: 'alignment',
            section: 'translation',
            uuid: 'a1',
            label: '1.2',
            content: 'The dharma is good.',
            source: 'ཆོས་ལེགས།',
            volume: '3',
            folio: '12.a',
          },
        ],
        bibliographies: [
          { type: 'bibliography', uuid: 'b1', content: 'dharma' },
        ],
        glossaries: [{ type: 'glossary', uuid: 'g1', content: 'dharma' }],
      });
      const { json } = await run(small);
      expect(json).toEqual(small);
      expect(json.truncated).toBeUndefined();
      expect('truncated' in json).toBe(false);
    });

    it('returns a moderately sized set (well under the cap) untouched', async () => {
      const modest = results({
        alignments: makeAlignments(1).map((a) => ({
          ...a,
          content: 'short english',
          source: 'short tibetan',
        })),
      });
      const { json } = await run(modest);
      expect(json).toEqual(modest);
    });

    it('returns an empty result set unchanged', async () => {
      const empty = results({});
      const { json } = await run(empty);
      expect(json).toEqual(empty);
    });
  });

  describe('source (criterion 6)', () => {
    it('defaults to the published source', async () => {
      const tool = createSearchTranslationTool(client);
      mockedSearch.mockResolvedValue(results({}));
      await tool.handler(input, extra);
      expect(mockedSearch).toHaveBeenCalledWith(
        expect.objectContaining({ source: 'published' }),
      );
    });

    it('defaults to published when options are empty', async () => {
      const tool = createSearchTranslationTool(client, {});
      mockedSearch.mockResolvedValue(results({}));
      await tool.handler(input, extra);
      expect(mockedSearch).toHaveBeenCalledWith(
        expect.objectContaining({ source: 'published' }),
      );
    });

    it('uses published when asked explicitly', async () => {
      const tool = createSearchTranslationTool(client, { source: 'published' });
      mockedSearch.mockResolvedValue(results({}));
      await tool.handler(input, extra);
      expect(mockedSearch).toHaveBeenCalledWith(
        expect.objectContaining({ source: 'published' }),
      );
    });

    it('searches drafts when the draft option is set', async () => {
      const tool = createSearchTranslationTool(client, { source: 'draft' });
      mockedSearch.mockResolvedValue(results({}));
      await tool.handler(input, extra);
      expect(mockedSearch).toHaveBeenCalledTimes(1);
      expect(mockedSearch).toHaveBeenCalledWith(
        expect.objectContaining({ source: 'draft' }),
      );
    });

    describe('createReadTools threading', () => {
      const findSearch = (tools: ReturnType<typeof createReadTools>) => {
        const tool = tools.find((t) => t.name === 'search-translation');
        expect(tool).toBeDefined();
        return tool!;
      };

      it('includes search-translation, defaulting to published', async () => {
        const tool = findSearch(createReadTools(client));
        mockedSearch.mockResolvedValue(results({}));
        await tool.handler(input, extra);
        expect(mockedSearch).toHaveBeenCalledWith(
          expect.objectContaining({ source: 'published' }),
        );
      });

      it('defaults to published when options are empty', async () => {
        const tool = findSearch(createReadTools(client, {}));
        mockedSearch.mockResolvedValue(results({}));
        await tool.handler(input, extra);
        expect(mockedSearch).toHaveBeenCalledWith(
          expect.objectContaining({ source: 'published' }),
        );
      });

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

      it('threads searchTranslationSource: published to search-translation', async () => {
        const tool = findSearch(
          createReadTools(client, { searchTranslationSource: 'published' }),
        );
        mockedSearch.mockResolvedValue(results({}));
        await tool.handler(input, extra);
        expect(mockedSearch).toHaveBeenCalledWith(
          expect.objectContaining({ source: 'published' }),
        );
      });

      it('keeps exposing exactly one search-translation tool', () => {
        const tools = createReadTools(client, {
          searchTranslationSource: 'draft',
        });
        expect(
          tools.filter((t) => t.name === 'search-translation'),
        ).toHaveLength(1);
      });
    });
  });
});
