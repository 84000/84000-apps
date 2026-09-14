import {
  BODY_MATTER,
  BodyItemType,
  DataClient,
  PassageAlignment,
  PassageAlignmentDTO,
  PassageAlignmentsPage,
  TohokuCatalogEntry,
  passageAlignmentFromDTO,
} from './types';
import {
  DEFAULT_CONTENT_SOURCE,
  relationFor,
  type ContentSource,
} from './content-source';

/**
 * Columns a work-scoped alignment read selects. `english` is appended only when
 * the caller asks: it is the passage content the reader already has from
 * `getTranslationPassages`, and it roughly doubles the payload.
 */
const ALIGNMENT_COLUMNS =
  'passage_uuid, folio_uuid, toh, tibetan, folio_number, volume_number, label';

/**
 * Passages per request. PostgREST rejects a URL beyond roughly 16KB and a uuid
 * costs ~39 characters in an `in` list, so an unbounded page would surface as an
 * opaque fetch failure rather than a validation error. 200 is the batch size the
 * passage readers already use.
 */
const MAX_BATCH = 200;

/**
 * Passage types a stored alignment can attach to.
 *
 * Body matter is the scope the compare view already works in, plus
 * `translationHeader`, which a handful of works align. Scanning a whole work
 * instead spends entire pages on front matter that carries no alignment — in
 * toh312 the first aligned passage is the 27th of 146, so an unfiltered first
 * page comes back empty.
 */
export const ALIGNABLE_PASSAGE_TYPES: BodyItemType[] = [
  ...BODY_MATTER,
  'translationHeader',
];

type GetWorkAlignmentsArgs = {
  client: DataClient;
  uuid: string;
  /** Pins the source edition when a work is catalogued under several numbers. */
  toh?: TohokuCatalogEntry;
  page?: number;
  size?: number;
  /** Absolute offset into the work's ordered passages; takes precedence over `page`. */
  offset?: number;
  includeEnglish?: boolean;
  /** Passage types to scan; defaults to those that carry alignments. */
  types?: BodyItemType[];
  source?: ContentSource;
};

/**
 * Read a page of a work's stored passage alignments, in passage reading order.
 *
 * Ordering is why this pages over passages rather than over the alignment view.
 * `passage_alignments` is a materialized view carrying no passage `sort`, and
 * ordering it by folio position instead does not reproduce reading order:
 * several passages begin on the same folio side, leaving an arbitrary tiebreak.
 * Measured against a 225-alignment work, folio order agreed with passage order
 * at 43 positions and drifted by as much as 8. So the passage table supplies the
 * order and the view supplies the Tibetan.
 *
 * The scan covers `ALIGNABLE_PASSAGE_TYPES` rather than every passage, so front
 * matter does not fill pages with nothing. `size` still counts passages rather
 * than alignments, and an unaligned one inside that scope returns nothing, so a
 * page can come back short with the body still ahead of it. `hasMore` is
 * reported for that reason and must not be inferred from the page length.
 */
export const getWorkAlignments = async ({
  client,
  uuid,
  toh,
  page = 0,
  size = 20,
  offset,
  includeEnglish = false,
  types = ALIGNABLE_PASSAGE_TYPES,
  source = DEFAULT_CONTENT_SOURCE,
}: GetWorkAlignmentsArgs): Promise<PassageAlignmentsPage> => {
  const empty: PassageAlignmentsPage = {
    alignments: [],
    passagesScanned: 0,
    hasMore: false,
  };

  const pageSize = Math.min(size, MAX_BATCH);
  const start = offset ?? page * pageSize;

  // One extra row answers `hasMore` without a second count query.
  const { data: passageRows, error: passageError } = await client
    .from(relationFor('passages', source))
    .select('uuid, sort')
    // `sort` repeats across a work's Tohoku numbers, so it is not a total order
    // on its own; the uuid tiebreak keeps paging from skipping or repeating.
    .eq('work_uuid', uuid)
    .in('type', types)
    .order('sort', { ascending: true })
    .order('uuid', { ascending: true })
    .range(start, start + pageSize);

  if (passageError) {
    console.error('Error fetching passages for alignments:', passageError);
    return empty;
  }

  const rows = (passageRows ?? []) as { uuid: string; sort: number }[];
  const hasMore = rows.length > pageSize;
  const pageRows = hasMore ? rows.slice(0, pageSize) : rows;

  if (pageRows.length === 0) {
    return empty;
  }

  const passageUuids = pageRows.map((row) => row.uuid);
  const columns = includeEnglish
    ? `${ALIGNMENT_COLUMNS}, english`
    : ALIGNMENT_COLUMNS;

  let query = client
    .from('passage_alignments')
    .select(columns)
    .in('passage_uuid', passageUuids);

  if (toh) {
    query = query.eq('toh', toh);
  }

  const { data, error } = await query;

  if (error) {
    console.error('Error fetching work alignments:', error);
    return empty;
  }

  // A passage carries one alignment per Tohoku placement — toh312 sits at three
  // points in the canon, so each of its passages has three. Group rather than
  // index so reordering by passage below keeps every row.
  const byPassage = new Map<string, PassageAlignmentDTO[]>();
  for (const dto of (data ?? []) as unknown as PassageAlignmentDTO[]) {
    const existing = byPassage.get(dto.passage_uuid);
    if (existing) {
      existing.push(dto);
    } else {
      byPassage.set(dto.passage_uuid, [dto]);
    }
  }

  const alignments = pageRows.flatMap((row) =>
    (byPassage.get(row.uuid) ?? [])
      // Keep each placement's spans together, then in folio order within it —
      // interleaving editions by volume would read as one broken sequence.
      .sort(
        (a, b) =>
          a.toh.localeCompare(b.toh) ||
          a.volume_number - b.volume_number ||
          a.folio_number - b.folio_number,
      )
      .map(passageAlignmentFromDTO),
  );

  return {
    alignments,
    passagesScanned: pageRows.length,
    hasMore,
    nextOffset: hasMore ? start + pageRows.length : undefined,
  };
};

type GetPassageAlignmentsArgs = {
  client: DataClient;
  passageUuids: readonly string[];
  toh?: TohokuCatalogEntry;
  includeEnglish?: boolean;
};

/**
 * Read the stored alignments for specific passages.
 *
 * Unlike `getWorkAlignments` this imposes no reading order — the caller already
 * chose the passages and knows what order it wants them in. Results come back
 * grouped by passage uuid for that reason.
 */
export const getPassageAlignments = async ({
  client,
  passageUuids,
  toh,
  includeEnglish = false,
}: GetPassageAlignmentsArgs): Promise<Map<string, PassageAlignment[]>> => {
  const byPassage = new Map<string, PassageAlignment[]>();

  if (passageUuids.length === 0) {
    return byPassage;
  }

  const columns = includeEnglish
    ? `${ALIGNMENT_COLUMNS}, english`
    : ALIGNMENT_COLUMNS;

  for (let i = 0; i < passageUuids.length; i += MAX_BATCH) {
    const batch = passageUuids.slice(i, i + MAX_BATCH) as string[];

    let query = client
      .from('passage_alignments')
      .select(columns)
      .in('passage_uuid', batch);

    if (toh) {
      query = query.eq('toh', toh);
    }

    const { data, error } = await query;

    if (error) {
      console.error('Error fetching passage alignments:', error);
      return new Map();
    }

    for (const dto of (data ?? []) as unknown as PassageAlignmentDTO[]) {
      const alignment = passageAlignmentFromDTO(dto);
      const existing = byPassage.get(dto.passage_uuid);
      if (existing) {
        existing.push(alignment);
      } else {
        byPassage.set(dto.passage_uuid, [alignment]);
      }
    }
  }

  return byPassage;
};
