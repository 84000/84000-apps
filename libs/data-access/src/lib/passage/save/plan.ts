import {
  ANNOTATIONS_TO_IGNORE,
  annotationRangeFits,
  passagesToDTO,
  type AnnotationDTO,
  type Passage,
  type PassageRowDTO,
} from '../../types';
import {
  annotationHasChanged,
  passageRowHasChanged,
  type ExistingAnnotationRow,
  type ExistingPassageRow,
} from './diff';
import { remapIgnoredRows } from './remap';
import type { AnnotationWriteRow, PassageWriteRow } from './types';

/**
 * A passage row to write. A column the caller left out keeps its stored
 * value, or is null on a new row: in a batch upsert, a key one row omits is
 * written as null for that row. A save therefore never clears one.
 */
export const passageWriteRow = (
  row: PassageRowDTO,
  stored?: ExistingPassageRow,
): PassageWriteRow => ({
  uuid: row.uuid,
  work_uuid: row.work_uuid,
  content: row.content,
  label: row.label,
  sort: row.sort,
  type: row.type,
  xmlId: row.xmlId ?? stored?.xmlId ?? null,
  parent: row.parent ?? stored?.parent ?? null,
  toh: row.toh ?? stored?.toh ?? null,
});

/** An annotation row to write; see `passageWriteRow`. */
export const annotationWriteRow = (
  row: AnnotationDTO,
  stored?: ExistingAnnotationRow,
): AnnotationWriteRow => ({
  uuid: row.uuid,
  passage_uuid: row.passage_uuid ?? row.passageUuid ?? '',
  type: row.type,
  start: row.start,
  end: row.end,
  content: row.content ?? [],
  toh: row.toh ?? stored?.toh ?? null,
});

const ignored = new Set<string>(ANNOTATIONS_TO_IGNORE);

/**
 * The annotation writes a save makes: rows that differ from what is stored,
 * and stored rows on a saved passage that the save no longer has. Stored
 * rows are kept when their passage's export was incomplete, when the caller
 * keeps them as stored or limits deletes to `deletable`, when they are of a
 * type editors never load, or when the caller sent them but they could not
 * be serialized. Rows of a type editors never load follow their passage's
 * text where they safely can; see `remapIgnoredRows`.
 */
export const planAnnotations = ({
  passages,
  annotationRows,
  existing,
  storedContent,
  keep = [],
  deletable,
}: {
  passages: Passage[];
  annotationRows: AnnotationDTO[];
  existing: ExistingAnnotationRow[];
  /** Stored content of each saved passage that already exists. */
  storedContent: Map<string, string>;
  keep?: readonly string[];
  deletable?: readonly string[];
}): {
  upserts: AnnotationWriteRow[];
  unchanged: AnnotationWriteRow[];
  deletes: string[];
  warnings: string[];
} => {
  const stored = new Map(existing.map((row) => [row.uuid, row]));
  const rows = [
    ...passagesToDTO(passages).flatMap((dto) => dto.annotations ?? []),
    ...annotationRows,
  ].map((row) => annotationWriteRow(row, stored.get(row.uuid)));
  const upserts: AnnotationWriteRow[] = [];
  const unchanged: AnnotationWriteRow[] = [];
  rows.forEach((row) =>
    (annotationHasChanged(row, stored.get(row.uuid))
      ? upserts
      : unchanged
    ).push(row),
  );

  const sent = new Set([
    ...rows.map((row) => row.uuid),
    ...passages.flatMap((passage) => passage.annotations.map((a) => a.uuid)),
  ]);
  const incomplete = new Set(
    passages
      .filter((passage) => passage.annotationsIncomplete)
      .map((passage) => passage.uuid),
  );
  const kept = new Set(keep);
  const leftAlone = (row: ExistingAnnotationRow) =>
    sent.has(row.uuid) ||
    kept.has(row.uuid) ||
    incomplete.has(row.passage_uuid);
  const allowed = deletable ? new Set(deletable) : undefined;
  const deletes = existing
    .filter(
      (row) =>
        !leftAlone(row) &&
        !ignored.has(row.type) &&
        (!allowed || allowed.has(row.uuid)),
    )
    .map((row) => row.uuid);

  const { moved, warnings } = remapIgnoredRows({
    existing,
    storedContent,
    content: new Map(
      passages.map((passage) => [passage.uuid, passage.content]),
    ),
    skip: leftAlone,
  });
  moved.forEach((row) =>
    upserts.push(annotationWriteRow(row, stored.get(row.uuid))),
  );

  return { upserts, unchanged, deletes, warnings };
};

/**
 * The first annotation the save leaves out of range, described for an error
 * message: a written row that does not fit its passage's final content, or an
 * unchanged one that fit the stored content and no longer does. A stored row
 * already out of range and left alone is not checked.
 */
export const findOutOfRange = ({
  upserts,
  unchanged,
  contentByPassage,
  storedContentByPassage,
}: {
  upserts: AnnotationWriteRow[];
  unchanged: AnnotationWriteRow[];
  contentByPassage: Map<string, string>;
  storedContentByPassage: Map<string, string>;
}): string | undefined => {
  const broken = unchanged.filter((row) => {
    const before = storedContentByPassage.get(row.passage_uuid);
    return (
      before !== undefined &&
      before !== contentByPassage.get(row.passage_uuid) &&
      annotationRangeFits(row.start, row.end, before.length)
    );
  });
  for (const row of [...upserts, ...broken]) {
    const length = contentByPassage.get(row.passage_uuid)?.length ?? 0;
    if (!annotationRangeFits(row.start, row.end, length)) {
      return `annotation ${row.uuid} (${row.type}) spans [${row.start}, ${row.end}), outside passage ${row.passage_uuid} of length ${length}`;
    }
  }
  return undefined;
};

/** The passage rows a save writes: those that differ from what is stored. */
export const planPassages = (
  passages: PassageRowDTO[],
  stored: Map<string, ExistingPassageRow>,
): PassageWriteRow[] =>
  passages
    .map((row) => passageWriteRow(row, stored.get(row.uuid)))
    .filter((row) => passageRowHasChanged(row, stored.get(row.uuid)));
