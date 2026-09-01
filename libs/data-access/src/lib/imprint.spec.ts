import {
  getTranslationImprint,
  getTranslationImprints,
  imprintKey,
} from './imprint';
import type { DataClient } from './types';

type QueryResult = { data: unknown; error: unknown };

type RecordedQuery = {
  table: string;
  columns?: string;
  filters: { op: string; column: string; value: unknown }[];
  orders: { column: string; ascending?: boolean; nullsFirst?: boolean }[];
  ranges: [number, number][];
};

type MockQueryBuilder = {
  select: (columns: string) => MockQueryBuilder;
  in: (column: string, value: unknown) => MockQueryBuilder;
  eq: (column: string, value: unknown) => MockQueryBuilder;
  order: (
    column: string,
    opts?: { ascending?: boolean; nullsFirst?: boolean },
  ) => MockQueryBuilder;
  range: (from: number, to: number) => Promise<QueryResult>;
};

/**
 * Records every query the imprint read builds and serves results per table.
 *
 * The six reads all resolve through `.range()` — the assembly pages each one —
 * so results are keyed by table rather than served from a single queue. A table
 * mapped to an array serves one entry per call, which is how paging and work
 * batching are exercised.
 */
const createMockClient = (
  resultsByTable: Record<string, QueryResult | QueryResult[]>,
) => {
  const queries: RecordedQuery[] = [];
  const pending = new Map<string, QueryResult[]>();

  for (const [table, result] of Object.entries(resultsByTable)) {
    pending.set(table, Array.isArray(result) ? [...result] : [result]);
  }

  const nextFor = (table: string): QueryResult => {
    const queue = pending.get(table);
    if (!queue || queue.length === 0) {
      return { data: [], error: null };
    }
    return queue.length === 1 ? queue[0] : (queue.shift() as QueryResult);
  };

  const rpc = jest.fn();

  const client = {
    rpc,
    from: jest.fn((table: string) => {
      const query: RecordedQuery = {
        table,
        filters: [],
        orders: [],
        ranges: [],
      };
      queries.push(query);

      const builder: MockQueryBuilder = {
        select: (columns: string) => {
          query.columns = columns;
          return builder;
        },
        in: (column: string, value: unknown) => {
          query.filters.push({ op: 'in', column, value });
          return builder;
        },
        eq: (column: string, value: unknown) => {
          query.filters.push({ op: 'eq', column, value });
          return builder;
        },
        order: (column, opts) => {
          query.orders.push({ column, ...opts });
          return builder;
        },
        range: (from: number, to: number) => {
          query.ranges.push([from, to]);
          return Promise.resolve(nextFor(table));
        },
      };

      return builder;
    }),
  };

  return { client: client as unknown as DataClient, queries, rpc };
};

const forTable = (queries: RecordedQuery[], table: string) =>
  queries.filter((query) => query.table === table);

const WORK = 'work-1';
const TOH = 'toh312';
const KEY = { uuid: WORK, toh: TOH };

const workRow = (overrides: Record<string, unknown> = {}) => ({
  uuid: WORK,
  publicationDate: '2020-04-08',
  publicationVersion: '1.1.33',
  restriction: false,
  publisher: 'publisher-1',
  license: 'license-1',
  work_toh: [{ toh_clean: TOH }],
  work_versions: { version: '1.1.34' },
  ...overrides,
});

const title = (
  type: string,
  language: string,
  content: string,
  catalogue_work_xmlid: string | null = null,
) => ({ work_uuid: WORK, type, language, content, catalogue_work_xmlid });

const credit = (
  type: string,
  specific: string | null,
  authorityNames: { language: string; content: string }[] = [],
  status: string | null = null,
) => ({
  work_uuid: WORK,
  type,
  status,
  names: specific ? { content: specific } : null,
  authorities: { names: authorityNames },
});

const sectionRow = (content: string, toh = TOH) => ({
  work_uuid: WORK,
  toh,
  catalogs: { catalog_names: [{ content }] },
});

/** A complete, unremarkable set of reads for one work. */
const fullReads = () => ({
  works: { data: [workRow()], error: null },
  titles: {
    data: [
      title('eft:mainTitle', 'en', 'The Sūtra'),
      title('eft:mainTitle', 'bo', 'མདོ'),
      title('eft:longTitle', 'en', 'The Noble Sūtra'),
      title('eft:toh', 'en', 'Toh 312'),
    ],
    error: null,
  },
  folio_annotations: {
    data: [{ work_uuid: WORK, toh: '312', source_description: 'Degé Kangyur' }],
    error: null,
  },
  creators: {
    data: [
      credit('tibetanAuthor', 'Nāgārjuna', [], 'contested'),
      credit('tibetanTranslator', 'Yeshé Dé'),
    ],
    error: null,
  },
  catalog_works: { data: [sectionRow('General Sūtra Section')], error: null },
  settings: {
    data: [
      { uuid: 'publisher-1', name: '84000', description: 'A statement.', link: null },
      {
        uuid: 'license-1',
        name: 'CC BY-NC-ND',
        description: 'A license.',
        link: 'https://example.test/license',
      },
    ],
    error: null,
  },
});

describe('getTranslationImprints', () => {
  beforeEach(() => {
    jest.spyOn(console, 'error').mockImplementation(() => undefined);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('assembles the imprint from tables rather than the get_imprints RPC', async () => {
    const { client, queries, rpc } = createMockClient(fullReads());

    await getTranslationImprints({ client, keys: [KEY] });

    expect(rpc).not.toHaveBeenCalled();
    expect(new Set(queries.map(({ table }) => table))).toEqual(
      new Set([
        'works',
        'titles',
        'folio_annotations',
        'creators',
        'catalog_works',
        'settings',
      ]),
    );
  });

  it('resolves section from the English catalog_names main title', async () => {
    const { client, queries } = createMockClient(fullReads());

    const imprints = await getTranslationImprints({ client, keys: [KEY] });

    // The section used to come from `catalogs.label`, which differs in case and
    // wording from the name the catalog publishes.
    expect(imprints.get(imprintKey(KEY))?.section).toBe(
      'General Sūtra Section',
    );

    const [sections] = forTable(queries, 'catalog_works');
    expect(sections.columns).toContain('catalogs(catalog_names(content))');
    expect(sections.filters).toEqual(
      expect.arrayContaining([
        { op: 'eq', column: 'catalogs.catalog_names.language', value: 'en' },
        {
          op: 'eq',
          column: 'catalogs.catalog_names.type',
          value: 'mainTitle',
        },
      ]),
    );
  });

  it('maps every imprint field the reader shows', async () => {
    const { client } = createMockClient(fullReads());

    const imprint = (
      await getTranslationImprints({ client, keys: [KEY] })
    ).get(imprintKey(KEY));

    expect(imprint).toEqual({
      uuid: WORK,
      toh: 'Toh 312',
      section: 'General Sūtra Section',
      version: '1.1.34',
      restriction: false,
      publishYear: '2020',
      tibetanAuthors: ['Nāgārjuna'],
      isAuthorContested: true,
      sourceDescription: 'Degé Kangyur',
      publisherStatement: 'A statement.',
      tibetanTranslators: 'Yeshé Dé',
      license: {
        name: 'CC BY-NC-ND',
        description: 'A license.',
        link: 'https://example.test/license',
      },
      mainTitles: { en: 'The Sūtra', bo: 'མདོ' },
      longTitles: { en: 'The Noble Sūtra' },
    });
  });

  it('prefers the live work version over the deprecated publicationVersion', async () => {
    const { client } = createMockClient({
      ...fullReads(),
      works: { data: [workRow({ work_versions: null })], error: null },
    });

    const imprint = (
      await getTranslationImprints({ client, keys: [KEY] })
    ).get(imprintKey(KEY));

    expect(imprint?.version).toBe('1.1.33');
  });

  it('keeps only titles that apply to the requested toh', async () => {
    const { client } = createMockClient({
      ...fullReads(),
      titles: {
        data: [
          title('eft:mainTitle', 'en', 'This Toh', TOH),
          title('eft:mainTitle', 'bo', 'Another Toh', 'toh628'),
        ],
        error: null,
      },
    });

    const imprint = (
      await getTranslationImprints({ client, keys: [KEY] })
    ).get(imprintKey(KEY));

    expect(imprint?.mainTitles).toEqual({ en: 'This Toh' });
  });

  it('orders titles so the database picks the winning content, not JavaScript', async () => {
    const { client, queries } = createMockClient(fullReads());

    await getTranslationImprints({ client, keys: [KEY] });

    const [titles] = forTable(queries, 'titles');
    // Descending content reproduces the `max()` the RPC aggregated with; the
    // uuid makes the order total so the read can be paged safely.
    expect(titles.orders).toEqual([
      { column: 'content', ascending: false, nullsFirst: false },
      { column: 'uuid', ascending: true },
    ]);
  });

  it('credits a creator by its own name, falling back to its authority', async () => {
    const { client } = createMockClient({
      ...fullReads(),
      creators: {
        data: [
          credit('tibetanAuthor', null, [
            { language: 'en', content: 'Zeta' },
            { language: 'en', content: 'Alpha' },
            { language: 'bo', content: 'ignored' },
          ]),
          credit('tibetanAuthor', 'Named Author'),
          credit('tibetanTranslator', null, [
            { language: 'bo', content: 'ye shes sde' },
            { language: 'en', content: 'ignored' },
          ]),
        ],
        error: null,
      },
    });

    const imprint = (
      await getTranslationImprints({ client, keys: [KEY] })
    ).get(imprintKey(KEY));

    // Authors fall back to English, translators to Tibetan, and the fallback is
    // the first name in that language by content.
    expect(imprint?.tibetanAuthors).toEqual(['Alpha', 'Named Author']);
    expect(imprint?.tibetanTranslators).toBe('ye shes sde');
  });

  it('deduplicates credited names', async () => {
    const { client } = createMockClient({
      ...fullReads(),
      creators: {
        data: [
          credit('tibetanAuthor', 'Same Name'),
          credit('tibetanAuthor', 'Same Name'),
        ],
        error: null,
      },
    });

    const imprint = (
      await getTranslationImprints({ client, keys: [KEY] })
    ).get(imprintKey(KEY));

    expect(imprint?.tibetanAuthors).toEqual(['Same Name']);
    expect(imprint?.isAuthorContested).toBe(false);
  });

  it('omits a pair whose toh the work does not carry', async () => {
    const { client } = createMockClient(fullReads());

    const imprints = await getTranslationImprints({
      client,
      keys: [{ uuid: WORK, toh: 'toh999' }],
    });

    expect(imprints.size).toBe(0);
  });

  it('omits a pair with no work row', async () => {
    const { client } = createMockClient({
      ...fullReads(),
      works: { data: [], error: null },
    });

    const imprints = await getTranslationImprints({ client, keys: [KEY] });

    expect(imprints.size).toBe(0);
  });

  it('pages a read past the row cap PostgREST applies silently', async () => {
    // PostgREST truncates at 1000 rows without saying so, which is how the
    // get_imprints RPC came to drop everything past the first thousand.
    const firstPage = Array.from({ length: 1000 }, (_, index) =>
      title('eft:mainTitle', 'en', `Title ${index}`),
    );

    const { client, queries } = createMockClient({
      ...fullReads(),
      titles: [
        { data: firstPage, error: null },
        { data: [title('eft:toh', 'en', 'Toh 312')], error: null },
      ],
    });

    const imprint = (
      await getTranslationImprints({ client, keys: [KEY] })
    ).get(imprintKey(KEY));

    // Each page rebuilds the query, so the ranges land one per recorded read.
    expect(forTable(queries, 'titles').flatMap(({ ranges }) => ranges)).toEqual(
      [
        [0, 999],
        [1000, 1999],
      ],
    );
    // The second page is only reachable by paging.
    expect(imprint?.toh).toBe('Toh 312');
  });

  it('batches work uuids so the request URL stays under the server limit', async () => {
    const uuids = Array.from({ length: 201 }, (_, index) => `work-${index}`);
    const { client, queries } = createMockClient({
      ...fullReads(),
      works: { data: [], error: null },
    });

    await getTranslationImprints({
      client,
      keys: uuids.map((uuid) => ({ uuid, toh: TOH })),
    });

    const works = forTable(queries, 'works');
    expect(works).toHaveLength(2);
    expect((works[0].filters[0].value as string[])).toHaveLength(200);
    expect((works[1].filters[0].value as string[])).toHaveLength(1);
  });

  it('deduplicates work uuids across keys', async () => {
    const { client, queries } = createMockClient(fullReads());

    await getTranslationImprints({
      client,
      keys: [
        { uuid: WORK, toh: TOH },
        { uuid: WORK, toh: 'toh628' },
      ],
    });

    const [works] = forTable(queries, 'works');
    expect(works.filters[0].value).toEqual([WORK]);
  });

  it('returns an empty map on error rather than throwing', async () => {
    const { client } = createMockClient({
      ...fullReads(),
      titles: { data: null, error: { message: 'permission denied' } },
    });

    const imprints = await getTranslationImprints({ client, keys: [KEY] });

    expect(imprints.size).toBe(0);
  });

  it('queries nothing when given no keys', async () => {
    const { client, queries } = createMockClient(fullReads());

    const imprints = await getTranslationImprints({ client, keys: [] });

    expect(imprints.size).toBe(0);
    expect(queries).toHaveLength(0);
  });
});

describe('getTranslationImprint', () => {
  beforeEach(() => {
    jest.spyOn(console, 'error').mockImplementation(() => undefined);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('reads a single imprint through the batch assembly', async () => {
    const { client, rpc } = createMockClient(fullReads());

    const imprint = await getTranslationImprint({
      client,
      uuid: WORK,
      toh: TOH,
    });

    expect(rpc).not.toHaveBeenCalled();
    expect(imprint?.section).toBe('General Sūtra Section');
    expect(imprint?.uuid).toBe(WORK);
  });

  it('returns undefined when the pair has no imprint', async () => {
    const { client } = createMockClient({
      ...fullReads(),
      works: { data: [], error: null },
    });

    const imprint = await getTranslationImprint({
      client,
      uuid: WORK,
      toh: TOH,
    });

    expect(imprint).toBeUndefined();
  });
});
