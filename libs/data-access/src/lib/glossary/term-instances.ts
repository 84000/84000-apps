import { inBatches } from '../passage/in-batches';
import { canonicalToh, type DataClient } from '../types';

/** Instances listed per page of the editor's instance table. */
export const GLOSSARY_INSTANCES_PAGE_SIZE = 50;
/** The most instances one page may hold. */
export const MAX_GLOSSARY_INSTANCES_LIMIT = 100;

/** Words of passage text shown on each side of an instance. */
export const GLOSSARY_INSTANCE_CONTEXT_WORDS = 5;

/** The text an instance covers, with a few words either side of it. */
export type GlossaryInstanceContext = {
  before: string;
  text: string;
  after: string;
  /** Passage text before `before` was left out. */
  truncatedStart: boolean;
  /** Passage text after `after` was left out. */
  truncatedEnd: boolean;
  /**
   * The offsets fall outside the passage text, so nothing could be cut: the
   * row is still listed, with a warning, rather than failing the page.
   */
  outOfRange: boolean;
};

/** One glossary-instance annotation citing an entry. */
export type GlossaryTermInstanceRow = GlossaryInstanceContext & {
  /** The annotation's uuid. */
  uuid: string;
  passageUuid: string;
  passageLabel: string | null;
  passageType: string;
  passageSort: number;
  /** Offsets in the passage text, in UTF-16 code units. */
  start: number;
  end: number;
};

/** One page of an entry's instances, with the total across all pages. */
export type GlossaryTermInstancesPage = {
  items: GlossaryTermInstanceRow[];
  /** Instances listed for the entry in all, across every page. */
  totalCount: number;
  /** Where this page starts among them. */
  offset: number;
};

const isWhitespace = (char: string | undefined) =>
  char !== undefined && /\s/.test(char);

/**
 * Cuts the text an instance covers out of its passage, with up to `words`
 * whitespace-separated words on each side; letters joined to the instance
 * (as in "bodhisattva's") count as one. Offsets are UTF-16 code units, as
 * annotation offsets are. Pure.
 */
export const cutGlossaryInstanceContext = (
  content: string | null | undefined,
  start: number,
  end: number,
  words = GLOSSARY_INSTANCE_CONTEXT_WORDS,
): GlossaryInstanceContext => {
  const length = content?.length ?? 0;
  if (
    content == null ||
    !Number.isInteger(start) ||
    !Number.isInteger(end) ||
    start < 0 ||
    end < start ||
    end > length
  ) {
    return {
      before: '',
      text: '',
      after: '',
      truncatedStart: false,
      truncatedEnd: false,
      outOfRange: true,
    };
  }

  let from = start;
  for (let counted = 0; counted < words && from > 0; counted++) {
    while (from > 0 && isWhitespace(content[from - 1])) from--;
    while (from > 0 && !isWhitespace(content[from - 1])) from--;
  }

  let to = end;
  for (let counted = 0; counted < words && to < length; counted++) {
    while (to < length && isWhitespace(content[to])) to++;
    while (to < length && !isWhitespace(content[to])) to++;
  }

  // Whitespace at a cut reads as a stray gap beside the ellipsis.
  while (from < start && isWhitespace(content[from])) from++;
  while (to > end && isWhitespace(content[to - 1])) to--;

  return {
    before: content.slice(from, start),
    text: content.slice(start, end),
    after: content.slice(end, to),
    truncatedStart: content.slice(0, from).trim().length > 0,
    truncatedEnd: content.slice(to).trim().length > 0,
    outOfRange: false,
  };
};

/**
 * A PostgREST filter keeping rows whose `toh` is shared (null or empty) or
 * lists `toh` among its comma-separated Tohs, as the reader's Toh rule reads
 * it. `toh` must be canonical, since it is written into the filter.
 */
const tohScopeFilter = (toh: string) =>
  [
    'toh.is.null',
    'toh.eq.""',
    `toh.eq.${toh}`,
    `toh.like."${toh},*"`,
    `toh.like."*,${toh}"`,
    `toh.like."*,${toh},*"`,
  ].join(',');

type InstanceRow = {
  uuid: string;
  start: number;
  end: number;
  passage_uuid: string;
  passages: {
    label: string | null;
    sort: number;
    type: string;
  } | null;
};

/**
 * A page of the glossary-instance annotations that cite one entry, one row
 * per instance, in passage order and then by offset. Reads the draft copy:
 * the table is the editor's.
 *
 * Counts the same instances as the passages dialog
 * (`get_glossary_term_excerpts`): those whose content holds the entry's own
 * uuid, and with `toh`, only the passages and instances shared by every Toh or
 * scoped to that one. A `toh` that is not a catalogued Toh reads nothing.
 *
 * Returns null when a read fails, so a caller can tell a failure from an entry
 * with no instances.
 */
export const getGlossaryTermInstances = async ({
  client,
  uuid,
  toh,
  first,
  offset,
}: {
  client: DataClient;
  uuid: string;
  toh?: string | null;
  first?: number | null;
  offset?: number | null;
}): Promise<GlossaryTermInstancesPage | null> => {
  const limit = Math.min(
    Math.max(first ?? GLOSSARY_INSTANCES_PAGE_SIZE, 1),
    MAX_GLOSSARY_INSTANCES_LIMIT,
  );
  const from = Math.max(Math.floor(offset ?? 0), 0);
  const scope = toh ? canonicalToh(toh) : undefined;
  if (toh && !scope) {
    console.error(`Not a Toh: ${toh}`);
    return null;
  }

  let query = client
    .from('passage_annotations')
    .select(
      'uuid, start, end, passage_uuid, passages!inner(label, sort, type)',
      {
        count: 'exact',
      },
    )
    .eq('type', 'glossary-instance')
    .contains('content', JSON.stringify([{ uuid }]));
  if (scope) {
    query = query
      .or(tohScopeFilter(scope))
      .or(tohScopeFilter(scope), { referencedTable: 'passages' });
  }
  // Passage sort is not unique within a work, so the passage uuid breaks ties
  // before the offsets do.
  const { data, error, count } = await query
    .order('passages(sort)')
    .order('passage_uuid')
    .order('start')
    .order('end')
    .order('uuid')
    .range(from, from + limit - 1);

  if (error) {
    console.error('Error fetching glossary term instances:', error);
    return null;
  }

  const rows = (data ?? []) as unknown as InstanceRow[];
  const passageUuids = [...new Set(rows.map((row) => row.passage_uuid))];
  const contentByPassage = new Map<string, string | null>();
  for (const batch of inBatches(passageUuids)) {
    const { data: passages, error: contentError } = await client
      .from('passages')
      .select('uuid, content')
      .in('uuid', batch);
    if (contentError) {
      console.error('Error fetching passage text for instances:', contentError);
      return null;
    }
    for (const passage of (passages ?? []) as {
      uuid: string;
      content: string | null;
    }[]) {
      contentByPassage.set(passage.uuid, passage.content);
    }
  }

  return {
    items: rows.map((row) => ({
      uuid: row.uuid,
      passageUuid: row.passage_uuid,
      passageLabel: row.passages?.label ?? null,
      passageType: row.passages?.type ?? 'translation',
      passageSort: row.passages?.sort ?? 0,
      start: row.start,
      end: row.end,
      ...cutGlossaryInstanceContext(
        contentByPassage.get(row.passage_uuid),
        row.start,
        row.end,
      ),
    })),
    totalCount: count ?? 0,
    offset: from,
  };
};
