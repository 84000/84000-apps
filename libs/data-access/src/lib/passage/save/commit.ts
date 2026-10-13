import type { DataClient } from '../../types';
import type {
  AnnotationWriteRow,
  PassageWriteRow,
  RenumberedPassageRow,
} from './types';

/** Passages per call when a save is committed in chunks. */
export const CHUNK_PASSAGES = 500;
/** Annotations per call when a save is committed in chunks. */
export const CHUNK_ANNOTATIONS = 10_000;

/** Every row a save writes, as `apply_passage_save` takes them. */
export type SaveCommit = {
  passages: PassageWriteRow[];
  labels: RenumberedPassageRow[];
  annotations: AnnotationWriteRow[];
  deleteAnnotations: string[];
  deletePassages: string[];
};

export type CommitFailure = {
  error: string;
  /** Passages committed by earlier chunks. */
  savedPassages: number;
  /** The call may have been applied: its response was lost. */
  outcomeUnknown: boolean;
};

/**
 * A large save without passage deletions, split into calls small enough to
 * finish within the statement timeout. Each passage's annotations go with it;
 * labels and annotation deletes go with the first call. A passage with more
 * annotations than a chunk holds goes alone.
 */
export const chunkCommit = (commit: SaveCommit): SaveCommit[] => {
  if (
    commit.deletePassages.length > 0 ||
    (commit.passages.length <= CHUNK_PASSAGES &&
      commit.annotations.length <= CHUNK_ANNOTATIONS)
  ) {
    return [commit];
  }
  const byPassage = new Map<string, AnnotationWriteRow[]>();
  commit.annotations.forEach((row) =>
    byPassage.set(row.passage_uuid, [
      ...(byPassage.get(row.passage_uuid) ?? []),
      row,
    ]),
  );
  // Annotations whose passage is not rewritten, such as moved marks, go
  // first, with the labels.
  const passageUuids = new Set(commit.passages.map((row) => row.uuid));
  const loose = commit.annotations.filter(
    (row) => !passageUuids.has(row.passage_uuid),
  );
  const chunks: SaveCommit[] = [
    { ...commit, passages: [], annotations: loose },
  ];
  commit.passages.forEach((row) => {
    const annotations = byPassage.get(row.uuid) ?? [];
    let chunk = chunks[chunks.length - 1];
    if (
      chunk.passages.length > 0 &&
      (chunk.passages.length >= CHUNK_PASSAGES ||
        chunk.annotations.length + annotations.length > CHUNK_ANNOTATIONS)
    ) {
      chunk = {
        passages: [],
        labels: [],
        annotations: [],
        deleteAnnotations: [],
        deletePassages: [],
      };
      chunks.push(chunk);
    }
    chunk.passages.push(row);
    chunk.annotations.push(...annotations);
  });
  return chunks;
};

/**
 * Whether a failed call is known to have written nothing: Postgres rolled it
 * back (a SQLSTATE), or PostgREST refused it before running it.
 */
const rolledBack = (code: unknown) =>
  typeof code === 'string' && /^(?:[0-9A-Z]{5}|PGRST\d+)$/.test(code);

/**
 * Writes a planned save through `apply_passage_save`, which applies each call
 * in one transaction. A large save without passage deletions is written in
 * chunks (see `chunkCommit`), so is not all-or-nothing: on a failure, the
 * chunks before it stay written.
 */
export const commitSave = async (
  client: DataClient,
  commit: SaveCommit,
): Promise<{ savedPassages: number } | CommitFailure> => {
  let savedPassages = 0;
  for (const chunk of chunkCommit(commit)) {
    const { error } = await client.rpc('apply_passage_save', {
      p_passages: chunk.passages,
      p_labels: chunk.labels,
      p_annotations: chunk.annotations,
      p_delete_annotations: chunk.deleteAnnotations,
      p_delete_passages: chunk.deletePassages,
    });
    if (error) {
      console.error('Error committing passage save:', error);
      const unknown = !rolledBack(error.code);
      const before = `the first ${savedPassages} of ${commit.passages.length} passages were saved`;
      const why = savedPassages
        ? unknown
          ? `Partly saved: ${before}, and the rest may have been`
          : `Partly saved: ${before}, and the rest were not`
        : unknown
          ? 'The save may have been applied'
          : 'Nothing was saved';
      return {
        error: `${why}: ${error.message}`,
        savedPassages,
        outcomeUnknown: unknown,
      };
    }
    savedPassages += chunk.passages.length;
  }
  return { savedPassages };
};
