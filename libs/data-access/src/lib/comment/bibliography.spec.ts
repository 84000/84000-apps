import { getBibliographyCommentAnchors } from './bibliography';
import type { DataClient } from '../types';

type Row = { uuid: string; work_uuid: string; bibl_html: string };

const mark = (comment: string, uuid: string, text: string) =>
  `<span class="comment-mark" type="comment" comment="${comment}" uuid="${uuid}">${text}</span>`;

/** Filters the way PostgREST would for the calls the read makes. */
const fakeClient = (rows: Row[], error?: { message: string }) => {
  const query = (filters: ((row: Row) => boolean)[] = []) => {
    const builder = {
      select: () => builder,
      order: () => builder,
      range: () => builder,
      eq: (column: keyof Row, value: string) =>
        query([...filters, (row) => row[column] === value]),
      like: (column: keyof Row, pattern: string) => {
        const needle = pattern.replace(/^%|%$/g, '');
        return query([...filters, (row) => row[column].includes(needle)]);
      },
      then: (resolve: (value: unknown) => unknown) =>
        resolve(
          error
            ? { data: null, error }
            : {
                data: rows.filter((row) => filters.every((f) => f(row))),
                error: null,
              },
        ),
    };
    return builder;
  };

  return { from: () => query() } as unknown as DataClient;
};

describe('getBibliographyCommentAnchors', () => {
  const rows: Row[] = [
    {
      uuid: 'r1',
      work_uuid: 'w1',
      bibl_html: `<p>${mark('t1', 'a1', 'A')}</p>`,
    },
    { uuid: 'r2', work_uuid: 'w1', bibl_html: '<p>Plain</p>' },
    {
      uuid: 'r3',
      work_uuid: 'w1',
      bibl_html: `<p>B ${mark('t2', 'a2', 'C')}</p>`,
    },
    {
      uuid: 'x1',
      work_uuid: 'w2',
      bibl_html: `<p>${mark('t3', 'a3', 'D')}</p>`,
    },
  ];

  it("lists the work's rows and places their marks", async () => {
    const result = await getBibliographyCommentAnchors({
      client: fakeClient(rows),
      workUuid: 'w1',
    });

    expect(result?.rows).toEqual(['r1', 'r2', 'r3']);
    expect(result?.anchorsByRow).toEqual(
      new Map([
        ['r1', [{ uuid: 'a1', comment: 't1', start: 0, end: 1 }]],
        ['r3', [{ uuid: 'a2', comment: 't2', start: 2, end: 3 }]],
      ]),
    );
    expect(result?.markedThreads).toEqual(new Set(['t1', 't2']));
  });

  it('is null when the read fails', async () => {
    const spy = jest.spyOn(console, 'error').mockImplementation(() => null);

    const result = await getBibliographyCommentAnchors({
      client: fakeClient(rows, { message: 'boom' }),
      workUuid: 'w1',
    });

    expect(result).toBeNull();
    spy.mockRestore();
  });
});
