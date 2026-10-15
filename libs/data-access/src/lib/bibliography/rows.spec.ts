import {
  getBibliographyRows,
  saveBibliographyRows,
  storedBibliographyHtml,
} from './rows';
import {
  bibliographyRowFromDTO,
  bibliographyRowToDTO,
  type BibliographyRow,
  type BibliographyRowDTO,
  type DataClient,
} from '../types';

const WORK = 'work-1';

type RpcCall = { name: string; args: Record<string, unknown> };

/**
 * A client over one work's rows. `apply_bibliography_save` upserts and
 * deletes them as the database function does, and answers with its counts.
 */
const fakeClient = ({
  rows = [] as BibliographyRowDTO[],
  readError,
  rpcError,
  counts,
}: {
  rows?: BibliographyRowDTO[];
  readError?: { message: string };
  rpcError?: { message: string; code?: string };
  counts?: Record<string, number>;
} = {}) => {
  const state = {
    rows: [...rows],
    calls: [] as RpcCall[],
    ranges: [] as number[][],
  };

  const query = () => {
    let workUuid: string | undefined;
    let range: [number, number] = [0, Infinity];
    const builder = {
      select: () => builder,
      eq: (_column: string, value: string) => {
        workUuid = value;
        return builder;
      },
      order: () => builder,
      range: (from: number, to: number) => {
        range = [from, to];
        state.ranges.push(range);
        return builder;
      },
      then: (resolve: (value: unknown) => void) => {
        if (readError) return resolve({ data: null, error: readError });
        const data = state.rows
          .filter((row) => row.work_uuid === workUuid)
          .sort((a, b) => a.sort - b.sort)
          .slice(range[0], range[1] + 1);
        return resolve({ data, error: null });
      },
    };
    return builder;
  };

  const rpc = async (name: string, args: Record<string, unknown>) => {
    state.calls.push({ name, args });
    if (rpcError) return { data: null, error: rpcError };
    const written = args.p_rows as Omit<BibliographyRowDTO, 'work_uuid'>[];
    const deletes = args.p_delete as string[];
    written.forEach((row) => {
      const next = { ...row, work_uuid: args.p_work_uuid as string };
      const at = state.rows.findIndex((r) => r.uuid === row.uuid);
      if (at >= 0) state.rows[at] = next;
      else state.rows.push(next);
    });
    state.rows = state.rows.filter((row) => !deletes.includes(row.uuid));
    return {
      data: counts ?? {
        rows: written.length,
        deleted: deletes.length,
        refreshed: 0,
      },
      error: null,
    };
  };

  return { client: { from: query, rpc } as unknown as DataClient, state };
};

const dto = (
  uuid: string,
  sort: number,
  extra: Partial<BibliographyRowDTO> = {},
): BibliographyRowDTO => ({
  uuid,
  work_uuid: WORK,
  bibl_html: `<p>${uuid}</p>`,
  sort,
  is_heading: false,
  heading_uuid: 'h1',
  ...extra,
});

const HEADING = dto('h1', 1, {
  bibl_html: 'Tibetan Texts',
  is_heading: true,
  heading_uuid: null,
});

describe('bibliography row mappers', () => {
  it('round-trips a row through its DTO', () => {
    const row = dto('e1', 2, { bibl_html: '<p>Bu­ddha</p>' });
    expect(bibliographyRowToDTO(bibliographyRowFromDTO(row))).toEqual(row);
    expect(bibliographyRowFromDTO(HEADING)).toEqual({
      uuid: 'h1',
      workUuid: WORK,
      html: 'Tibetan Texts',
      sort: 1,
      isHeading: true,
      headingUuid: null,
    });
  });
});

describe('getBibliographyRows', () => {
  it('reads one work flat, in sort order', async () => {
    const { client } = fakeClient({
      rows: [
        dto('e2', 3),
        HEADING,
        dto('e1', 2),
        dto('x', 1, { work_uuid: 'other' }),
      ],
    });

    const rows = await getBibliographyRows({ client, workUuid: WORK });

    expect(rows?.map((row) => row.uuid)).toEqual(['h1', 'e1', 'e2']);
    expect(rows?.[1].headingUuid).toBe('h1');
  });

  it('reads past a page', async () => {
    const many = Array.from({ length: 1001 }, (_, at) => dto(`e${at}`, at + 2));
    const { client, state } = fakeClient({ rows: [HEADING, ...many] });

    const rows = await getBibliographyRows({ client, workUuid: WORK });

    expect(rows).toHaveLength(1002);
    expect(state.ranges).toEqual([
      [0, 999],
      [1000, 1999],
    ]);
  });

  it('is null when the read fails', async () => {
    jest.spyOn(console, 'error').mockImplementation(() => undefined);
    const { client } = fakeClient({ readError: { message: 'boom' } });

    expect(await getBibliographyRows({ client, workUuid: WORK })).toBeNull();
  });
});

describe('storedBibliographyHtml', () => {
  const row = (html: string, isHeading = false): BibliographyRow => ({
    ...bibliographyRowFromDTO(dto('e1', 2)),
    html,
    isHeading,
  });

  it('keeps an entry, its soft hyphens and whitespace', () => {
    const html = ' <p><em>Bu­ddha</em> and <a href="https://x.org">x</a></p>\n';
    expect(storedBibliographyHtml(row(html))).toBe(html);
  });

  it('drops scripts and handlers from an entry', () => {
    expect(
      storedBibliographyHtml(
        row(
          '<p onclick="x()">One<script>bad()</script><img src=x onerror=y></p>',
        ),
      ),
    ).toBe('<p>One</p>');
  });

  it('stores a heading as given, however often it is saved', () => {
    const text = 'Texts &lt;revised&gt; & <Studies>';
    const once = storedBibliographyHtml(row(text, true));
    expect(once).toBe(text);
    expect(storedBibliographyHtml(row(once ?? '', true))).toBe(text);
  });

  it('is null when nothing is left', () => {
    expect(storedBibliographyHtml(row('<p><img src=x></p>'))).toBeNull();
    expect(storedBibliographyHtml(row('  ', true))).toBeNull();
  });
});

describe('saveBibliographyRows', () => {
  const rowsOf = (...dtos: BibliographyRowDTO[]) =>
    dtos.map(bibliographyRowFromDTO);

  it('round-trips rows through save and read', async () => {
    const { client } = fakeClient();
    const rows = rowsOf(
      HEADING,
      dto('e1', 2, { bibl_html: '<p>One, <em>edited</em>.</p>' }),
    );

    const saved = await saveBibliographyRows({ client, workUuid: WORK, rows });

    expect(saved).toEqual({ success: true, rows, deleted: 0 });
    expect(await getBibliographyRows({ client, workUuid: WORK })).toEqual(rows);
  });

  it('writes sanitized rows and deletes in one call', async () => {
    const { client, state } = fakeClient({
      rows: [HEADING, dto('e1', 2), dto('e2', 3)],
    });
    const edited = {
      ...bibliographyRowFromDTO(dto('e1', 2)),
      html: '<p onclick="x()">One</p>',
    };

    const result = await saveBibliographyRows({
      client,
      workUuid: WORK,
      rows: [edited],
      deleteUuids: ['e2'],
    });

    expect(result).toEqual({
      success: true,
      rows: [{ ...edited, html: '<p>One</p>' }],
      deleted: 1,
    });
    expect(state.calls).toEqual([
      {
        name: 'apply_bibliography_save',
        args: {
          p_work_uuid: WORK,
          p_rows: [
            {
              uuid: 'e1',
              bibl_html: '<p>One</p>',
              sort: 2,
              is_heading: false,
              heading_uuid: 'h1',
            },
          ],
          p_delete: ['e2'],
        },
      },
    ]);
    expect(state.rows.map((row) => row.uuid)).toEqual(['h1', 'e1']);
  });

  it('does not call the database for an empty save', async () => {
    const { client, state } = fakeClient();
    expect(
      await saveBibliographyRows({ client, workUuid: WORK, rows: [] }),
    ).toEqual({
      success: true,
      rows: [],
      deleted: 0,
    });
    expect(state.calls).toHaveLength(0);
  });

  it.each([
    [
      'a row from another work',
      rowsOf(dto('e1', 2, { work_uuid: 'other' })),
      [],
      'another work',
    ],
    [
      'a row saved twice',
      rowsOf(dto('e1', 2), dto('e1', 3)),
      [],
      'saved twice',
    ],
    [
      'a row saved and deleted',
      rowsOf(dto('e1', 2)),
      ['e1'],
      'both saved and deleted',
    ],
    [
      'an empty row',
      rowsOf(dto('e1', 2, { bibl_html: '<p></p>' })),
      [],
      'empty',
    ],
  ])(
    'refuses %s without writing',
    async (_name, rows, deleteUuids, message) => {
      const { client, state } = fakeClient();

      const result = await saveBibliographyRows({
        client,
        workUuid: WORK,
        rows,
        deleteUuids,
      });

      expect(result).toMatchObject({ success: false, outcomeUnknown: false });
      expect(result.success === false && result.error).toContain(message);
      expect(state.calls).toHaveLength(0);
    },
  );

  it('reports a refused save as unwritten', async () => {
    jest.spyOn(console, 'error').mockImplementation(() => undefined);
    const { client } = fakeClient({
      rpcError: { message: 'wrote 0 of 1 rows', code: 'P0001' },
    });

    expect(
      await saveBibliographyRows({
        client,
        workUuid: WORK,
        rows: rowsOf(dto('e1', 2)),
      }),
    ).toEqual({
      success: false,
      error: 'Nothing was saved: wrote 0 of 1 rows',
      outcomeUnknown: false,
    });
  });

  it('reports a lost response as possibly applied', async () => {
    jest.spyOn(console, 'error').mockImplementation(() => undefined);
    const { client } = fakeClient({ rpcError: { message: 'fetch failed' } });

    expect(
      await saveBibliographyRows({
        client,
        workUuid: WORK,
        rows: rowsOf(dto('e1', 2)),
      }),
    ).toMatchObject({ success: false, outcomeUnknown: true });
  });

  it('checks the counts the database reports', async () => {
    jest.spyOn(console, 'error').mockImplementation(() => undefined);
    const { client } = fakeClient({
      counts: { rows: 0, deleted: 0, refreshed: 0 },
    });

    expect(
      await saveBibliographyRows({
        client,
        workUuid: WORK,
        rows: rowsOf(dto('e1', 2)),
      }),
    ).toMatchObject({ success: false, outcomeUnknown: true });
  });
});
