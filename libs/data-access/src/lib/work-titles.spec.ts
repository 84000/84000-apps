import { getTranslationTitles, getWorkTitles } from './publications';
import type { DataClient } from './types';

type Query = {
  table?: string;
  columns?: string;
  filters: [string, unknown][];
  orders: [string, boolean | undefined][];
};

/**
 * Records the query that was built and resolves with whatever rows the test
 * configured. Titles are read straight from the table now, so the column list,
 * the alias, and the ordering are all application code — and all things that can
 * regress silently.
 */
const makeFakeClient = (
  query: Query,
  result: { data?: unknown; error?: { message: string } } = {},
): DataClient =>
  ({
    from(table: string) {
      query.table = table;
      const builder = {
        select(columns: string) {
          query.columns = columns;
          return builder;
        },
        eq(column: string, value: unknown) {
          query.filters.push([column, value]);
          return builder;
        },
        order(column: string, opts?: { ascending?: boolean }) {
          query.orders.push([column, opts?.ascending]);
          return builder;
        },
        then(
          resolve: (value: {
            data: unknown;
            error: { message: string } | null;
          }) => void,
        ) {
          resolve({
            data: result.data ?? [],
            error: result.error ?? null,
          });
        },
      };
      return builder;
    },
  }) as unknown as DataClient;

const emptyQuery = (): Query => ({ filters: [], orders: [] });

describe('getWorkTitles', () => {
  beforeEach(() => {
    jest.spyOn(console, 'error').mockImplementation(() => undefined);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('reads the titles table rather than the get_work_titles RPC', async () => {
    const query = emptyQuery();

    await getWorkTitles({ client: makeFakeClient(query), uuid: 'work-1' });

    expect(query.table).toBe('titles');
    expect(query.filters).toEqual([['work_uuid', 'work-1']]);
  });

  it('aliases content to title and asks for attestation', async () => {
    const query = emptyQuery();

    await getWorkTitles({ client: makeFakeClient(query), uuid: 'work-1' });

    // The alias is the only thing the RPC did that a plain select does not, and
    // attestation is the column whose absence made it invisible to the editor.
    expect(query.columns).toContain('title:content');
    expect(query.columns).toContain('attestation');
    expect(query.columns).toContain('uuid');
    expect(query.columns).toContain('language');
    expect(query.columns).toContain('type');
  });

  it('orders the read so it does not reshuffle after an edit', async () => {
    const query = emptyQuery();

    await getWorkTitles({ client: makeFakeClient(query), uuid: 'work-1' });

    // An updated row moves to the end of the heap, so the order has to be
    // explicit and total.
    expect(query.orders).toEqual([
      ['type', true],
      ['language', true],
      ['uuid', true],
    ]);
  });

  it('maps rows through the DTO mapper, stripping the eft: prefix', async () => {
    const titles = await getWorkTitles({
      client: makeFakeClient(emptyQuery(), {
        data: [
          {
            uuid: 'title-1',
            title: 'The Perfection of Wisdom',
            language: 'en',
            type: 'eft:mainTitle',
            attestation: 'reconstructedPhonetic',
          },
        ],
      }),
      uuid: 'work-1',
    });

    expect(titles).toEqual([
      {
        uuid: 'title-1',
        title: 'The Perfection of Wisdom',
        language: 'en',
        type: 'mainTitle',
        attestation: 'reconstructedPhonetic',
      },
    ]);
  });

  it('omits an attestation the app does not recognise', async () => {
    const titles = await getWorkTitles({
      client: makeFakeClient(emptyQuery(), {
        data: [
          {
            uuid: 'title-1',
            title: 'A title',
            language: 'en',
            type: 'eft:mainTitle',
            attestation: 'somethingElse',
          },
        ],
      }),
      uuid: 'work-1',
    });

    expect(titles[0].attestation).toBeUndefined();
  });

  it('returns an empty list on error rather than throwing', async () => {
    const titles = await getWorkTitles({
      client: makeFakeClient(emptyQuery(), {
        error: { message: 'permission denied' },
      }),
      uuid: 'work-1',
    });

    expect(titles).toEqual([]);
  });

  it('getTranslationTitles resolves through the same query', async () => {
    const query = emptyQuery();

    await getTranslationTitles({
      client: makeFakeClient(query),
      uuid: 'work-1',
    });

    expect(query.table).toBe('titles');
    expect(query.columns).toContain('attestation');
  });
});
