import { lookup } from './lookup';

type Row = Record<string, string | null>;

const createClient = ({
  works = [],
  workToh = [],
  passages = [],
  glossaries = [],
  bibliographies = [],
}: {
  works?: Row[];
  workToh?: Row[];
  passages?: Row[];
  glossaries?: Row[];
  bibliographies?: Row[];
}) => {
  const tables: Record<string, Row[]> = {
    works,
    work_toh: workToh,
    passages,
    glossaries,
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
          const query = {
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

  return { client, queries };
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

  it('limits lookup to the provided type', async () => {
    const { client, queries } = createClient({
      passages: [{ uuid: 'passage-uuid' }],
      glossaries: [{ uuid: 'glossary-uuid' }],
    });

    await expect(
      lookup({ client, uuid: 'glossary-uuid', type: 'glossary' }),
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

    await expect(lookup({ client, xmlId: 'xml-id' })).resolves.toEqual({
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
      lookup({ client, xmlId: 'xml-id', type: 'glossary' }),
    ).resolves.toBeNull();
  });

  it('returns null when no identifier is provided', async () => {
    const { client, queries } = createClient({});

    await expect(lookup({ client })).resolves.toBeNull();
    expect(queries).toEqual([]);
  });
});
