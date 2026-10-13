import type {
  AnnotationDTOContent,
  AnnotationDTOType,
  BodyItemType,
  PassageRowDTO,
  TohokuCatalogEntry,
} from '../../types';

/**
 * A passage whose label the server changed while renumbering a series, rather
 * than because the client sent new content for it. The editor holds only a
 * window of a series, so these are mostly passages it never loaded; it needs
 * them to refresh the labels cached in `endNoteLink` marks without a reload.
 */
export type RenumberedPassageRow = {
  uuid: string;
  label: string;
};

export type SavedPassageRow = {
  uuid: string;
  workUuid: string;
  content: string;
  label: string;
  sort: number;
  type: BodyItemType;
  xmlId: string | null;
  toh: TohokuCatalogEntry | null;
};

export type SavePassagesWithDeletionsResult = {
  success: boolean;
  savedCount: number;
  deletedCount?: number;
  passages: SavedPassageRow[];
  renumberedPassages: RenumberedPassageRow[];
  error?: string;
  /** Problems that did not stop the save; it still succeeded. */
  warnings?: string[];
  /** The save failed, but may have been applied: its response was lost. */
  outcomeUnknown?: boolean;
};

/** A passage row with every column, so a batch upsert nulls nothing. */
export type PassageWriteRow = Omit<
  PassageRowDTO,
  'xmlId' | 'parent' | 'toh'
> & {
  xmlId: string | null;
  parent: string | null;
  toh: TohokuCatalogEntry | null;
};

/** An annotation row with every column, so a batch upsert nulls nothing. */
export type AnnotationWriteRow = {
  uuid: string;
  passage_uuid: string;
  type: AnnotationDTOType;
  start: number;
  end: number;
  content: AnnotationDTOContent[];
  toh: string | null;
};

/**
 * Where a new passage goes, by a saved passage next to it: the one it
 * follows, or, when it is first in its section, the one it precedes. Null
 * when neither exists; the passage's own sort then places it.
 */
export type NewPassageAnchor = { after: string } | { before: string } | null;

/** A step that failed, and why. */
export type StepError = { error: string };

export const failure = (
  error: string,
  savedCount = 0,
): SavePassagesWithDeletionsResult => ({
  success: false,
  savedCount,
  passages: [],
  renumberedPassages: [],
  error,
});
