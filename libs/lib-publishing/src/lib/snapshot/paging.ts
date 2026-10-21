/**
 * Paged PostgREST reads. Every read pages by keyset on a total order that ends in a unique
 * column, so rows written mid-read cannot be skipped or repeated, and uuid lists are
 * batched under the URL limit.
 */

import type { DataClient } from '@eightyfourthousand/data-access';

/** PostgREST's row cap; a shorter page means the read is done. */
export const DRAFT_PAGE_SIZE = 1000;

/** Uuids per `.in()` request. 300 overflowed the URL limit on alignments. */
export const IN_BATCH_SIZE = 150;

/* eslint-disable-next-line @typescript-eslint/no-explicit-any */
type Query = any;

/** Throws for a failed read; `what` is a draft relation unless it names its source. */
export const fail = (what: string, error: unknown): never => {
  const named = /^published /.test(what) ? what : `draft ${what}`;
  throw new Error(`Failed reading ${named}: ${JSON.stringify(error)}`);
};

export const chunk = <T>(items: readonly T[], size: number): T[][] => {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    out.push(items.slice(i, i + size));
  }
  return out;
};

/** PostgREST filter literal: quoted, so commas and parentheses stay inside the value. */
const literal = (value: unknown): string =>
  `"${String(value).replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`;

/**
 * Every row of `build()`, keyset-paged on `(sortColumn, idColumn)`; `idColumn` must be
 * unique. Rows with a null sort come last, paged on `idColumn` alone, since a keyset
 * comparison can never reach them.
 */
export const readKeyset = async <T extends Record<string, unknown>>({
  build,
  sortColumn,
  idColumn,
  nullableSort = false,
  what,
  pageSize = DRAFT_PAGE_SIZE,
}: {
  build: () => Query;
  sortColumn?: string;
  idColumn: string;
  nullableSort?: boolean;
  what: string;
  pageSize?: number;
}): Promise<T[]> => {
  const rows: T[] = [];

  const walk = async (sorted: boolean, restrict?: (q: Query) => Query) => {
    let last: T | undefined;
    for (;;) {
      let query: Query = build();
      if (restrict) query = restrict(query);
      if (last && sorted && sortColumn) {
        const s = literal(last[sortColumn]);
        const id = literal(last[idColumn]);
        query = query.or(
          `${sortColumn}.gt.${s},and(${sortColumn}.eq.${s},${idColumn}.gt.${id})`,
        );
      } else if (last) {
        query = query.gt(idColumn, last[idColumn]);
      }
      if (sorted && sortColumn) {
        query = query.order(sortColumn, { ascending: true });
      }
      const { data, error } = await query
        .order(idColumn, { ascending: true })
        .limit(pageSize);
      if (error) fail(what, error);
      const page = (data ?? []) as T[];
      rows.push(...page);
      if (page.length < pageSize) return;
      last = page[page.length - 1];
    }
  };

  if (!sortColumn) {
    await walk(false);
  } else if (!nullableSort) {
    await walk(true);
  } else {
    await walk(true, (q) => q.not(sortColumn, 'is', null));
    await walk(false, (q) => q.is(sortColumn, null));
  }
  return rows;
};

/** Every row whose `column` is in `values`, batched, keyset-paged inside each batch. */
export const readByIn = async <T extends Record<string, unknown>>({
  client,
  table,
  columns,
  column,
  values,
  idColumn,
  sortColumn,
  what,
  batchSize = IN_BATCH_SIZE,
  filter = (query) => query,
}: {
  client: DataClient;
  table: string;
  columns: string;
  column: string;
  values: readonly string[];
  idColumn: string;
  sortColumn?: string;
  what: string;
  batchSize?: number;
  /** Narrows each batch's query further. */
  filter?: (query: Query) => Query;
}): Promise<T[]> => {
  const out: T[] = [];
  for (const batch of chunk(values, batchSize)) {
    out.push(
      ...(await readKeyset<T>({
        build: () =>
          filter(client.from(table).select(columns).in(column, batch)),
        sortColumn,
        idColumn,
        what,
      })),
    );
  }
  return out;
};
