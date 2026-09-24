import type { BodyItemType, TohokuCatalogEntry } from '../../types';

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
};

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
