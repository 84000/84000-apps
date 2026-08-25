import { searchCanonSectionGlossaryTerms } from './section';
import { DataClient } from '../types';

type QueryResult = { data: unknown; error: unknown };

type RpcCall = { name: string; args: Record<string, unknown> };

type MockRpcBuilder = { select: () => Promise<QueryResult> };

/**
 * The chainable methods return the builder itself, so the type has to be
 * declared rather than inferred — TypeScript cannot infer a type that refers to
 * itself in its own initializer.
 */
type MockTableBuilder = {
  select: () => MockTableBuilder;
  in: () => Promise<QueryResult>;
};

/**
 * The section search calls `rpc(...).select(...)` for the glossary rows and then
 * `from('works').select(...).in(...)` to resolve work identity, so the mock has to
 * satisfy both shapes.
 */
const createMockClient = ({
  rows,
  rowsError,
  works,
}: {
  rows?: unknown[];
  rowsError?: { message: string };
  works?: unknown[];
}) => {
  const rpcCalls: RpcCall[] = [];

  const client = {
    rpc: jest.fn((name: string, args: Record<string, unknown>) => {
      rpcCalls.push({ name, args });
      const builder: MockRpcBuilder = {
        select: jest.fn(
          (): Promise<QueryResult> =>
            Promise.resolve({
              data: rowsError ? null : (rows ?? []),
              error: rowsError ?? null,
            }),
        ),
      };
      return builder;
    }),
    from: jest.fn(() => {
      const builder: MockTableBuilder = {
        select: jest.fn(() => builder),
        in: jest.fn(
          (): Promise<QueryResult> =>
            Promise.resolve({ data: works ?? [], error: null }),
        ),
      };
      return builder;
    }),
  };

  return { client: client as unknown as DataClient, rpcCalls };
};

const row = (overrides: Record<string, unknown> = {}) => ({
  work_uuid: 'work-a',
  glossary_uuid: 'glossary-1',
  authority_uuid: 'authority-1',
  term_number: 4,
  definition: 'the cumulative force of previous acts',
  headword: 'las',
  headword_language: 'Bo-Ltn',
  english: 'karma',
  wylie: 'las',
  tibetan: 'ལས',
  sanskrit_plain: 'karman',
  sanskrit_attested: 'karman (attested)',
  chinese: null,
  pali: null,
  alternatives: null,
  ...overrides,
});

describe('searchCanonSectionGlossaryTerms', () => {
  it('groups terms under their work and attaches citable work identity', async () => {
    const { client } = createMockClient({
      rows: [
        row(),
        row({ glossary_uuid: 'glossary-2', term_number: 9, english: 'action' }),
      ],
      works: [
        {
          uuid: 'work-a',
          title: 'The Root Manual of the Rites of Mañjuśrī',
          tohs: [{ toh: 'toh543' }],
        },
      ],
    });

    const result = await searchCanonSectionGlossaryTerms({
      client,
      sectionUuid: 'section-1',
      query: 'karma',
    });

    expect(result).toHaveLength(1);
    expect(result[0].work).toEqual({
      uuid: 'work-a',
      title: 'The Root Manual of the Rites of Mañjuśrī',
      toh: ['toh543'],
    });
    expect(result[0].terms).toHaveLength(2);
    expect(result[0].terms[0]).toMatchObject({
      uuid: 'glossary-1',
      authority: 'authority-1',
      termNumber: 4,
      headword: 'las',
      headwordLanguage: 'Bo-Ltn',
      names: expect.objectContaining({ english: 'karma', sanskrit: 'karman' }),
    });
  });

  it('orders works by Tohoku number numerically, not as text', async () => {
    const { client } = createMockClient({
      rows: [
        row({ work_uuid: 'work-late', glossary_uuid: 'g1' }),
        row({ work_uuid: 'work-early', glossary_uuid: 'g2' }),
      ],
      works: [
        { uuid: 'work-late', title: 'Later', tohs: [{ toh: 'toh1000' }] },
        { uuid: 'work-early', title: 'Earlier', tohs: [{ toh: 'toh251' }] },
      ],
    });

    const result = await searchCanonSectionGlossaryTerms({
      client,
      sectionUuid: 'section-1',
      query: 'karma',
    });

    // Lexicographically 'toh1000' sorts before 'toh251'; catalog order does not.
    expect(result.map((entry) => entry.work.toh[0])).toEqual([
      'toh251',
      'toh1000',
    ]);
  });

  it('reads the published snapshot by default and draft only when asked', async () => {
    const published = createMockClient({ rows: [] });
    await searchCanonSectionGlossaryTerms({
      client: published.client,
      sectionUuid: 'section-1',
      query: 'karma',
    });

    const draft = createMockClient({ rows: [] });
    await searchCanonSectionGlossaryTerms({
      client: draft.client,
      sectionUuid: 'section-1',
      query: 'karma',
      source: 'draft',
    });

    expect(published.rpcCalls[0]?.name).toBe(
      'search_glossary_terms_by_section_published',
    );
    expect(draft.rpcCalls[0]?.name).toBe('search_glossary_terms_by_section');
  });

  it('passes the section, escaped term, clamped limit and descendant flag', async () => {
    const { client, rpcCalls } = createMockClient({ rows: [] });

    await searchCanonSectionGlossaryTerms({
      client,
      sectionUuid: 'section-1',
      query: '50%_karma',
      limit: 9000,
      includeDescendants: false,
    });

    expect(rpcCalls[0]?.args).toEqual({
      p_section_uuid: 'section-1',
      p_pattern: '50\\%\\_karma',
      p_limit: 200,
      p_include_descendants: false,
    });
  });

  it('selects the plain Sanskrit form unless attestations are requested', async () => {
    const plain = createMockClient({
      rows: [row()],
      works: [{ uuid: 'work-a', title: 'A', tohs: [{ toh: 'toh1' }] }],
    });
    const attested = createMockClient({
      rows: [row()],
      works: [{ uuid: 'work-a', title: 'A', tohs: [{ toh: 'toh1' }] }],
    });

    const withoutAttestations = await searchCanonSectionGlossaryTerms({
      client: plain.client,
      sectionUuid: 'section-1',
      query: 'karma',
    });
    const withAttestations = await searchCanonSectionGlossaryTerms({
      client: attested.client,
      sectionUuid: 'section-1',
      query: 'karma',
      withAttestations: true,
    });

    expect(withoutAttestations[0].terms[0].names.sanskrit).toBe('karman');
    expect(withAttestations[0].terms[0].names.sanskrit).toBe(
      'karman (attested)',
    );
  });

  it('still returns the terms when a work’s identity cannot be resolved', async () => {
    const { client } = createMockClient({ rows: [row()], works: [] });

    const result = await searchCanonSectionGlossaryTerms({
      client,
      sectionUuid: 'section-1',
      query: 'karma',
    });

    expect(result[0].work).toEqual({
      uuid: 'work-a',
      title: '<Untitled>',
      toh: [],
    });
    expect(result[0].terms).toHaveLength(1);
  });

  it('does not query for a blank term', async () => {
    const { client, rpcCalls } = createMockClient({});

    expect(
      await searchCanonSectionGlossaryTerms({
        client,
        sectionUuid: 'section-1',
        query: '  ',
      }),
    ).toEqual([]);
    expect(rpcCalls).toHaveLength(0);
  });

  it('returns an empty list on error rather than throwing', async () => {
    const { client } = createMockClient({ rowsError: { message: 'boom' } });

    expect(
      await searchCanonSectionGlossaryTerms({
        client,
        sectionUuid: 'section-1',
        query: 'karma',
      }),
    ).toEqual([]);
  });

  it('skips the work lookup when nothing matched', async () => {
    const { client } = createMockClient({ rows: [] });

    const result = await searchCanonSectionGlossaryTerms({
      client,
      sectionUuid: 'section-1',
      query: 'karma',
    });

    expect(result).toEqual([]);
    expect(client.from).not.toHaveBeenCalled();
  });
});
