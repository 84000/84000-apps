import type {
  BibliographyRow,
  BibliographyRowDTO,
  DataClient,
} from '@eightyfourthousand/data-access';

import { loadBibliographyWork } from './bibliography-work';

export const WORK = 'w1';

/** A stored entry, its HTML naming it. */
export const row = (
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

/** A stored heading, its text its uuid in capitals. */
export const heading = (
  uuid: string,
  sort: number,
  headingUuid: string | null = null,
) =>
  row(uuid, sort, { html: uuid.toUpperCase(), isHeading: true, headingUuid });

/** Two top-level headings, the second with a subheading, entries under each. */
export const NESTED = [
  heading('h1', 1),
  row('e1', 2, { headingUuid: 'h1' }),
  heading('h2', 3),
  heading('h3', 4, 'h2'),
  row('e3', 5, { headingUuid: 'h3' }),
  // Sorted before its heading's subheading, but read under its heading.
  row('e2', 6, { headingUuid: 'h2' }),
];

/** A client over one work's rows, answering the save as the database does. */
export const fakeClient = ({
  rows,
  readError,
  rpcError,
  lostAnswer,
}: {
  rows: BibliographyRow[];
  readError?: boolean;
  rpcError?: boolean;
  /** Apply the save, then answer as a dropped connection would. */
  lostAnswer?: boolean;
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
    if (lostAnswer) {
      const deleted = new Set(args.p_delete as string[]);
      const saved = (
        args.p_rows as Omit<BibliographyRowDTO, 'work_uuid'>[]
      ).map((dto) => ({ ...dto, work_uuid: WORK }));
      const kept = dtos.filter(
        (dto) =>
          !deleted.has(dto.uuid) && !saved.some((s) => s.uuid === dto.uuid),
      );
      dtos.splice(0, dtos.length, ...kept, ...saved);
      return { data: null, error: { message: 'Failed to fetch' } };
    }
    return {
      data: {
        rows: (args.p_rows as unknown[]).length,
        deleted: ((args.p_delete as unknown[]) ?? []).length,
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

/** A bibliography work over `rows`, every row hydrated. */
export const loadedBibliography = async (rows = NESTED) => {
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
