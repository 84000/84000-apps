import type { DataClient } from '@eightyfourthousand/data-access';

import {
  bibliographyReadingOrder,
  bibliographySeeds,
  hasUnsavedBibliographyChanges,
  loadBibliographyWork,
  placeBibliographyRows,
  planBibliographySave,
  saveBibliographyWork,
} from './bibliography-work';
import {
  deleteBibliographyRow,
  moveBibliographyRow,
  newBibliographyEntry,
  newBibliographyHeading,
} from './bibliography-structure';
import {
  fakeClient,
  heading,
  loadedBibliography,
  NESTED,
  row,
  WORK,
} from './bibliography-work.fixture';

// See PassageStackController.spec.ts — building the schema reaches
// `data-access/ssr` through two client barrels that leak it.
jest.mock('next/server', () => ({
  NextRequest: class {},
  NextResponse: class {},
}));
jest.mock('resend', () => ({ Resend: class {} }));

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

  it('reads the top-level entries first, wherever they sort', () => {
    const rows = [
      heading('h1', 1),
      row('e1', 2, { headingUuid: 'h1' }),
      row('a', 3),
      row('b', 0),
    ];
    expect(bibliographyReadingOrder(rows).map((r) => r.uuid)).toEqual([
      'b',
      'a',
      'h1',
      'e1',
    ]);
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

  it('numbers top-level headings after the top-level entries', () => {
    expect(
      bibliographySeeds([
        row('a', 1),
        row('b', 2),
        heading('h1', 3),
        row('e1', 4, { headingUuid: 'h1' }),
      ]).map(({ uuid, label, parent }) => [uuid, label, parent]),
    ).toEqual([
      ['a', 'b.1', undefined],
      ['b', 'b.2', undefined],
      ['h1', 'b.3', undefined],
      ['e1', 'b.3.1', 'h1'],
    ]);
  });
});

describe('placeBibliographyRows', () => {
  const place = (sorts: (number | undefined)[]) =>
    placeBibliographyRows(sorts.map((sort) => ({ sort })));

  it('keeps sorts already in order', () => {
    expect(place([1, 4, 9])).toEqual([1, 4, 9]);
  });

  it('fits a new row into a gap', () => {
    expect(place([1, 4, undefined, 9])).toEqual([1, 4, 5, 9]);
  });

  it('moves later rows on where there is no gap', () => {
    expect(place([1, 2, undefined, 3, 4, 9])).toEqual([1, 2, 3, 4, 5, 9]);
  });

  it('places only a moved row when the rest can keep theirs', () => {
    expect(place([1, 3, 2])).toEqual([1, 3, 4]);
  });

  it('places no row below the first sort', () => {
    expect(place([undefined, 1, 2])).toEqual([1, 2, 3]);
  });

  it('keeps the sorts of rows not written anyway first', () => {
    expect(
      placeBibliographyRows([
        { sort: 1 },
        { sort: 4, changed: true },
        { sort: 3 },
      ]),
    ).toEqual([1, 2, 3]);
    expect(place([1, 4, 3])).toEqual([1, 4, 5]);
  });

  it('places each heading’s entries on their own', () => {
    expect(
      placeBibliographyRows([
        { sort: 1 },
        { under: 'h1', sort: 5 },
        { sort: 2 },
        { under: 'h2', sort: 3 },
        { under: 'h2', sort: undefined },
      ]),
    ).toEqual([1, 5, 2, 3, 4]);
  });
});

describe('a bibliography work', () => {
  const loaded = loadedBibliography;

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

  it('is null, not thrown, when reading its rows throws', async () => {
    jest.spyOn(console, 'error').mockImplementation(() => undefined);
    expect(
      await loadBibliographyWork({
        workUuid: WORK,
        client: {} as DataClient,
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

  /** The rows sent by the save `calls` holds, by uuid. */
  const sent = (calls: Record<string, unknown>[]) =>
    Object.fromEntries(
      (calls[0].p_rows as { uuid: string }[]).map((r) => [r.uuid, r]),
    );

  it('writes a new entry with the sorts after it moved on', async () => {
    const rows = [
      heading('t', 1),
      ...[2, 3, 4, 5].map((sort) =>
        row(`e${sort}`, sort, { headingUuid: 't' }),
      ),
      heading('s', 6),
      ...[7, 8, 9].map((sort) => row(`e${sort}`, sort, { headingUuid: 's' })),
    ];
    const { bibliography, client, calls } = await loaded(rows);
    const uuid = newBibliographyEntry(bibliography.work, 'e3') as string;
    edit(bibliography, uuid, 'New');

    expect(await saveBibliographyWork(bibliography, client)).toBe(true);
    expect(sent(calls)).toEqual({
      [uuid]: {
        uuid,
        bibl_html: '<p>New</p>',
        sort: 4,
        is_heading: false,
        heading_uuid: 't',
      },
      e4: expect.objectContaining({ sort: 5, heading_uuid: 't' }),
      e5: expect.objectContaining({ sort: 6, heading_uuid: 't' }),
    });
    expect(hasUnsavedBibliographyChanges(bibliography)).toBe(false);
    expect(bibliography.work.spine.meta(uuid)?.sort).toBe(4);
  });

  it('writes a moved entry under its new heading', async () => {
    const { bibliography, client, calls } = await loaded();
    moveBibliographyRow(bibliography.work, 'e1', 'h3');

    expect(await saveBibliographyWork(bibliography, client)).toBe(true);
    expect(sent(calls)).toEqual({
      e1: expect.objectContaining({ sort: 6, heading_uuid: 'h3' }),
    });
    expect(bibliography.rows.get('e1')?.headingUuid).toBe('h3');
  });

  it('writes an entry moved to the top level before the first heading', async () => {
    const { bibliography, client, calls } = await loaded();
    moveBibliographyRow(bibliography.work, 'e2', null);

    expect(await saveBibliographyWork(bibliography, client)).toBe(true);
    const rows = sent(calls);
    expect(rows['e2']).toEqual(expect.objectContaining({ heading_uuid: null }));
    const firstHeading = Math.min(
      ...[...bibliography.rows.values()]
        .filter((r) => r.isHeading)
        .map((r) => r.sort),
    );
    expect(bibliography.rows.get('e2')?.sort).toBeLessThan(firstHeading);
    expect(bibliography.rows.get('e2')?.headingUuid).toBeNull();
  });

  it('moves a top-level entry stored after a heading before it', async () => {
    const { bibliography, client } = await loaded([
      heading('h1', 1),
      row('e1', 2, { headingUuid: 'h1' }),
      row('a', 3),
    ]);
    expect(bibliography.work.spine.uuids()).toEqual(['a', 'h1', 'e1']);

    expect(await saveBibliographyWork(bibliography, client)).toBe(true);
    const sorts = (uuid: string) => bibliography.rows.get(uuid)?.sort ?? NaN;
    expect(sorts('a')).toBeLessThan(sorts('h1'));
    expect(bibliography.rows.get('a')?.headingUuid).toBeNull();
  });

  it('deletes a removed row', async () => {
    const { bibliography, client, calls } = await loaded();
    deleteBibliographyRow(bibliography.work, 'e3');
    expect(hasUnsavedBibliographyChanges(bibliography)).toBe(true);

    expect(await saveBibliographyWork(bibliography, client)).toBe(true);
    expect(calls[0]).toMatchObject({ p_rows: [], p_delete: ['e3'] });
    expect(bibliography.rows.has('e3')).toBe(false);
    expect(hasUnsavedBibliographyChanges(bibliography)).toBe(false);
  });

  it('deletes a saved row whose insertion is undone after a redo', async () => {
    const { bibliography, client } = await loaded();
    const { work } = bibliography;
    const uuid = newBibliographyEntry(work, 'e1') as string;
    edit(bibliography, uuid, 'New');
    await saveBibliographyWork(bibliography, client);

    work.undo();
    work.undo();
    work.redo();
    work.redo();
    work.undo();
    work.undo();
    expect(work.spine.meta(uuid)).toBeNull();
    expect(planBibliographySave(bibliography).deleteUuids).toEqual([uuid]);
  });

  it('leaves out a new row with nothing in it', async () => {
    const { bibliography, client, calls } = await loaded();
    newBibliographyEntry(bibliography.work, 'e1');

    expect(hasUnsavedBibliographyChanges(bibliography)).toBe(false);
    expect(await saveBibliographyWork(bibliography, client)).toBe(true);
    expect(calls).toHaveLength(0);
  });

  it('moves no sorts on for a new row with nothing in it', async () => {
    const { bibliography } = await loaded([
      heading('h', 1),
      row('a', 2, { headingUuid: 'h' }),
      row('b', 3, { headingUuid: 'h' }),
    ]);
    newBibliographyEntry(bibliography.work, 'a');
    expect(hasUnsavedBibliographyChanges(bibliography)).toBe(false);
  });

  it('holds back rows under a new heading until it has a name', async () => {
    jest.spyOn(console, 'error').mockImplementation(() => undefined);
    const { bibliography, client, calls } = await loaded();
    const { work } = bibliography;
    const named = newBibliographyHeading(work, 'e1') as string;
    const entry = newBibliographyEntry(work, named) as string;
    edit(bibliography, entry, 'Under it');
    edit(bibliography, 'e2', 'Edited');

    expect(planBibliographySave(bibliography).held).toEqual([entry]);
    expect(await saveBibliographyWork(bibliography, client)).toBe(false);
    expect(Object.keys(sent(calls))).toEqual(['e2']);
    expect(hasUnsavedBibliographyChanges(bibliography)).toBe(true);

    edit(bibliography, named, 'Named');
    expect(await saveBibliographyWork(bibliography, client)).toBe(true);
    expect(calls[1].p_rows).toEqual([
      expect.objectContaining({ uuid: named, bibl_html: 'Named' }),
      expect.objectContaining({ uuid: entry, heading_uuid: named }),
    ]);
    expect(hasUnsavedBibliographyChanges(bibliography)).toBe(false);
  });

  it('holds back a stored row emptied of its text', async () => {
    jest.spyOn(console, 'error').mockImplementation(() => undefined);
    const { bibliography, client, calls } = await loaded();
    edit(bibliography, 'e1', '');

    expect(await saveBibliographyWork(bibliography, client)).toBe(false);
    expect(calls).toHaveLength(0);
    expect(hasUnsavedBibliographyChanges(bibliography)).toBe(true);
  });

  it('reads the rows back after a save that may have been applied', async () => {
    jest.spyOn(console, 'error').mockImplementation(() => undefined);
    const { bibliography } = await loaded();
    const uuid = newBibliographyEntry(bibliography.work, 'e1') as string;
    edit(bibliography, uuid, 'New');
    const { client } = fakeClient({ rows: NESTED, lostAnswer: true });

    expect(await saveBibliographyWork(bibliography, client)).toBe(false);
    expect(bibliography.rows.get(uuid)?.html).toBe('<p>New</p>');
    expect(hasUnsavedBibliographyChanges(bibliography)).toBe(false);
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
