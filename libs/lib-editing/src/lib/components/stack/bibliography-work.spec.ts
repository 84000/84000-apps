import type {
  BibliographyRow,
  BibliographyRowDTO,
  DataClient,
} from '@eightyfourthousand/data-access';

import {
  bibliographyReadingOrder,
  bibliographySeeds,
  hasUnsavedBibliographyChanges,
  loadBibliographyWork,
  saveBibliographyWork,
} from './bibliography-work';

// See PassageStackController.spec.ts — building the schema reaches
// `data-access/ssr` through two client barrels that leak it.
jest.mock('next/server', () => ({
  NextRequest: class {},
  NextResponse: class {},
}));
jest.mock('resend', () => ({ Resend: class {} }));

const WORK = 'w1';

const row = (
  uuid: string,
  sort: number,
  extra: Partial<BibliographyRow> = {},
): BibliographyRow => ({
  uuid,
  workUuid: WORK,
  html: `<p>${uuid}</p>`,
  sort,
  isHeading: false,
  headingUuid: null,
  ...extra,
});

const heading = (
  uuid: string,
  sort: number,
  headingUuid: string | null = null,
) =>
  row(uuid, sort, { html: uuid.toUpperCase(), isHeading: true, headingUuid });

/** Two top-level headings, the second with a subheading, entries under each. */
const NESTED = [
  heading('h1', 1),
  row('e1', 2, { headingUuid: 'h1' }),
  heading('h2', 3),
  heading('h3', 4, 'h2'),
  row('e3', 5, { headingUuid: 'h3' }),
  // Sorted before its heading's subheading, but read under its heading.
  row('e2', 6, { headingUuid: 'h2' }),
];

/** A client over one work's rows, answering the save as the database does. */
const fakeClient = ({
  rows,
  readError,
  rpcError,
}: {
  rows: BibliographyRow[];
  readError?: boolean;
  rpcError?: boolean;
}) => {
  const calls: Record<string, unknown>[] = [];
  const dtos: BibliographyRowDTO[] = rows.map((r) => ({
    uuid: r.uuid,
    work_uuid: r.workUuid,
    bibl_html: r.html,
    sort: r.sort,
    is_heading: r.isHeading,
    heading_uuid: r.headingUuid,
  }));
  const builder = {
    select: () => builder,
    eq: () => builder,
    order: () => builder,
    range: () => builder,
    then: (resolve: (value: unknown) => void) =>
      resolve(
        readError
          ? { data: null, error: { message: 'boom' } }
          : { data: dtos, error: null },
      ),
  };
  const rpc = async (_name: string, args: Record<string, unknown>) => {
    calls.push(args);
    if (rpcError)
      return { data: null, error: { message: 'no', code: 'P0001' } };
    return {
      data: {
        rows: (args.p_rows as unknown[]).length,
        deleted: 0,
        refreshed: 0,
      },
      error: null,
    };
  };
  return {
    client: { from: () => builder, rpc } as unknown as DataClient,
    calls,
  };
};

describe('bibliographyReadingOrder', () => {
  it('reads each heading by sort, followed by its entries', () => {
    expect(bibliographyReadingOrder(NESTED).map((r) => r.uuid)).toEqual([
      'h1',
      'e1',
      'h2',
      'e2',
      'h3',
      'e3',
    ]);
  });

  it('keeps entries in sort order in a work without headings', () => {
    expect(
      bibliographyReadingOrder([row('b', 2), row('a', 1)]).map((r) => r.uuid),
    ).toEqual(['a', 'b']);
  });

  it('keeps an entry whose heading is missing in its own place', () => {
    const rows = [
      row('e0', 1, { headingUuid: 'gone' }),
      heading('h1', 2),
      row('e1', 3, { headingUuid: 'h1' }),
    ];
    expect(bibliographyReadingOrder(rows).map((r) => r.uuid)).toEqual([
      'e0',
      'h1',
      'e1',
    ]);
  });
});

describe('bibliographySeeds', () => {
  it('labels, types and nests rows as the readers number them', () => {
    expect(bibliographySeeds(NESTED)).toEqual([
      { uuid: 'h1', label: 'b.1', type: 'bibliographyHeader', sort: 1 },
      {
        uuid: 'e1',
        label: 'b.1.1',
        type: 'bibliography',
        sort: 2,
        parent: 'h1',
        depth: 1,
      },
      { uuid: 'h2', label: 'b.2', type: 'bibliographyHeader', sort: 3 },
      {
        uuid: 'e2',
        label: 'b.2.1',
        type: 'bibliography',
        sort: 6,
        parent: 'h2',
        depth: 1,
      },
      {
        uuid: 'h3',
        label: 'b.2.1',
        type: 'bibliographyHeader',
        sort: 4,
        parent: 'h2',
        depth: 1,
      },
      {
        uuid: 'e3',
        label: 'b.2.1.1',
        type: 'bibliography',
        sort: 5,
        parent: 'h3',
        depth: 2,
      },
    ]);
  });

  it('numbers the entries of a work without headings on their own', () => {
    expect(
      bibliographySeeds([row('a', 1), row('b', 2)]).map((s) => s.label),
    ).toEqual(['b.1', 'b.2']);
  });
});

describe('a bibliography work', () => {
  const loaded = async (rows = NESTED) => {
    const fake = fakeClient({ rows });
    const bibliography = await loadBibliographyWork({
      workUuid: WORK,
      client: fake.client,
      graphql: {} as never,
    });
    if (!bibliography) throw new Error('not loaded');
    await bibliography.work.hydrateWindow({ start: 0, end: rows.length });
    return { ...fake, bibliography };
  };

  /** Write `text` over a row, as an editor would. */
  const edit = (
    bibliography: Awaited<ReturnType<typeof loaded>>['bibliography'],
    uuid: string,
    text: string,
  ) => {
    const doc = bibliography.work.store.peek(uuid);
    doc?.replaceContent({
      type: 'doc',
      content: [{ type: 'paragraph', content: [{ type: 'text', text }] }],
    });
    doc?.markDirty();
  };

  it('is null when its rows cannot be read', async () => {
    jest.spyOn(console, 'error').mockImplementation(() => undefined);
    const { client } = fakeClient({ rows: NESTED, readError: true });
    expect(
      await loadBibliographyWork({
        workUuid: WORK,
        client,
        graphql: {} as never,
      }),
    ).toBeNull();
  });

  it('seeds its spine in reading order and its rows from their HTML', async () => {
    const { bibliography } = await loaded();
    const { work } = bibliography;

    expect(work.spine.uuids()).toEqual(['h1', 'e1', 'h2', 'e2', 'h3', 'e3']);
    expect(work.store.peek('e1')?.text).toBe('e1');
    expect(work.store.peek('h1')?.text).toBe('H1');
    expect(hasUnsavedBibliographyChanges(bibliography)).toBe(false);
  });

  it('sends each edited row with its placement unchanged', async () => {
    const { bibliography, client, calls } = await loaded();
    edit(bibliography, 'e2', 'Edited & <kept>');
    edit(bibliography, 'h3', 'Renamed <heading>');

    expect(await saveBibliographyWork(bibliography, client)).toBe(true);

    expect(calls).toHaveLength(1);
    expect(calls[0].p_delete).toEqual([]);
    expect(calls[0].p_rows).toEqual(
      expect.arrayContaining([
        {
          uuid: 'e2',
          bibl_html: '<p>Edited &amp; &lt;kept&gt;</p>',
          sort: 6,
          is_heading: false,
          heading_uuid: 'h2',
        },
        {
          uuid: 'h3',
          bibl_html: 'Renamed <heading>',
          sort: 4,
          is_heading: true,
          heading_uuid: 'h2',
        },
      ]),
    );
    expect(hasUnsavedBibliographyChanges(bibliography)).toBe(false);
    expect(bibliography.rows.get('e2')?.html).toBe(
      '<p>Edited &amp; &lt;kept&gt;</p>',
    );
  });

  it('keeps its edits when the save fails', async () => {
    jest.spyOn(console, 'error').mockImplementation(() => undefined);
    const { bibliography } = await loaded();
    edit(bibliography, 'e1', 'Edited');
    const { client } = fakeClient({ rows: [], rpcError: true });

    expect(await saveBibliographyWork(bibliography, client)).toBe(false);
    expect(hasUnsavedBibliographyChanges(bibliography)).toBe(true);
    expect(bibliography.rows.get('e1')?.html).toBe('<p>e1</p>');
  });
});
