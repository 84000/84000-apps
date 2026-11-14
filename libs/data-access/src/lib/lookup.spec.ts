import { lookup } from './lookup';
import type { DataClient } from './types/client';

type Row = Record<string, string | null>;

type QueryChain = {
  eq: jest.Mock<QueryChain, [string, string]>;
  maybeSingle: jest.Mock<Promise<{ data: Row | null; error: null }>, []>;
};

const createClient = ({
  works = [],
  workToh = [],
  passages = [],
  glossaries = [],
  publishedGlossaries = [],
  bibliographies = [],
}: {
  works?: Row[];
  workToh?: Row[];
  passages?: Row[];
  glossaries?: Row[];
  publishedGlossaries?: Row[];
  bibliographies?: Row[];
}) => {
  const tables: Record<string, Row[]> = {
    works,
    work_toh: workToh,
    passages,
    glossaries,
    published_glossaries_live: publishedGlossaries,
    bibliographies,
  };
  const queries: Array<{
    table: string;
    filters: Array<{ column: string; value: string }>;
  }> = [];

  const client = {
    from: jest.fn((table: string) => ({
      select: jest.fn(() => ({
        eq: jest.fn(function eq(column: string, value: string) {
          const filters = [{ column, value }];
          const query: QueryChain = {
            eq: jest.fn((nextColumn: string, nextValue: string) => {
              filters.push({ column: nextColumn, value: nextValue });
              return query;
            }),
            maybeSingle: jest.fn(async () => {
              queries.push({ table, filters: [...filters] });
              const data = tables[table]?.find((row) =>
                filters.every(({ column, value }) => row[column] === value),
              );
              return { data: data ?? null, error: null };
            }),
          };
          return query;
        }),
      })),
    })),
  };

  return { client: client as unknown as DataClient, queries };
};

describe('lookup', () => {
  it('prefers toh over uuid and xmlId', async () => {
    const { client, queries } = createClient({
      workToh: [{ toh_clean: 'toh1', work_uuid: 'work-uuid' }],
      passages: [{ uuid: 'passage-uuid', xmlId: 'xml-id' }],
    });

    await expect(
      lookup({
        client,
        toh: 'toh1',
        uuid: 'passage-uuid',
        xmlId: 'xml-id',
      }),
    ).resolves.toEqual({ uuid: 'work-uuid', type: 'work' });

    expect(queries).toEqual([
      {
        table: 'work_toh',
        filters: [{ column: 'toh_clean', value: 'toh1' }],
      },
    ]);
  });

  it('prefers uuid over xmlId', async () => {
    const { client, queries } = createClient({
      passages: [{ uuid: 'passage-uuid', xmlId: 'xml-id' }],
      glossaries: [{ uuid: 'glossary-uuid', glossary_xmlId: 'xml-id' }],
    });

    await expect(
      lookup({ client, uuid: 'passage-uuid', xmlId: 'xml-id' }),
    ).resolves.toEqual({ uuid: 'passage-uuid', type: 'passage' });

    expect(queries.map(({ table }) => table)).toEqual(['works', 'passages']);
  });

  // The draft glossaries table; published lookups are covered by
  // lookup.acceptance.spec.ts.
  it('limits lookup to the provided type', async () => {
    const { client, queries } = createClient({
      passages: [{ uuid: 'passage-uuid' }],
      glossaries: [{ uuid: 'glossary-uuid' }],
    });

    await expect(
      lookup({
        client,
        uuid: 'glossary-uuid',
        type: 'glossary',
        source: 'draft',
      }),
    ).resolves.toEqual({ uuid: 'glossary-uuid', type: 'glossary' });

    expect(queries).toEqual([
      {
        table: 'glossaries',
        filters: [{ column: 'uuid', value: 'glossary-uuid' }],
      },
    ]);
  });

  it('looks up untyped xml IDs in entity order', async () => {
    const { client, queries } = createClient({
      glossaries: [
        {
          uuid: 'glossary-uuid',
          glossary_xmlId: 'xml-id',
          termType: 'translationMain',
        },
      ],
      bibliographies: [{ uuid: 'bibliography-uuid', xmlId: 'xml-id' }],
    });

    await expect(
      lookup({ client, xmlId: 'xml-id', source: 'draft' }),
    ).resolves.toEqual({
      uuid: 'glossary-uuid',
      type: 'glossary',
    });

    expect(queries.map(({ table }) => table)).toEqual([
      'works',
      'passages',
      'glossaries',
    ]);
    expect(queries[2]).toEqual({
      table: 'glossaries',
      filters: [
        { column: 'glossary_xmlId', value: 'xml-id' },
        { column: 'termType', value: 'translationMain' },
      ],
    });
  });

  it('does not return non-translation main glossary xml IDs', async () => {
    const { client } = createClient({
      glossaries: [
        {
          uuid: 'glossary-uuid',
          glossary_xmlId: 'xml-id',
          termType: 'other',
        },
      ],
    });

    await expect(
      lookup({ client, xmlId: 'xml-id', type: 'glossary', source: 'draft' }),
    ).resolves.toBeNull();
  });

  describe('published source', () => {
    // A draft-only glossary: the published lookup must neither find nor read it.
    const glossaries = [
      {
        uuid: 'draft-glossary-uuid',
        glossary_xmlId: 'glossary-xml-id',
        termType: 'translationMain',
      },
    ];

    it('resolves a glossary uuid through the published terms', async () => {
      const { client, queries } = createClient({
        glossaries,
        publishedGlossaries: [{ glossary_uuid: 'glossary-uuid' }],
      });

      await expect(
        lookup({ client, uuid: 'glossary-uuid', type: 'glossary' }),
      ).resolves.toEqual({ uuid: 'glossary-uuid', type: 'glossary' });

      expect(queries).toEqual([
        {
          table: 'published_glossaries_live',
          filters: [{ column: 'glossary_uuid', value: 'glossary-uuid' }],
        },
      ]);
    });

    it('does not resolve a glossary that is only in the draft table', async () => {
      const { client, queries } = createClient({ glossaries });

      await expect(
        lookup({ client, uuid: 'draft-glossary-uuid', type: 'glossary' }),
      ).resolves.toBeNull();
      await expect(
        lookup({ client, xmlId: 'glossary-xml-id', type: 'glossary' }),
      ).resolves.toBeNull();

      expect(queries.map(({ table }) => table)).not.toContain('glossaries');
    });

    it('skips the glossary step for an untyped xml ID', async () => {
      const { client, queries } = createClient({
        glossaries,
        bibliographies: [
          { uuid: 'bibliography-uuid', xmlId: 'glossary-xml-id' },
        ],
      });

      await expect(
        lookup({ client, xmlId: 'glossary-xml-id' }),
      ).resolves.toEqual({ uuid: 'bibliography-uuid', type: 'bibliography' });

      expect(queries.map(({ table }) => table)).toEqual([
        'works',
        'passages',
        'bibliographies',
      ]);
    });
  });

  it('returns null when no identifier is provided', async () => {
    const { client, queries } = createClient({});

    await expect(lookup({ client })).resolves.toBeNull();
    expect(queries).toEqual([]);
  });
});
