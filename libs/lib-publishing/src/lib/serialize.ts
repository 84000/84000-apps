/**
 * Incremental artifact serialization.
 *
 * Chunking is char-budget driven for passages and row-count driven for the rest. Chunk
 * size is deliberately an artifact-internal detail, decoupled from the reader's page size
 * (`char_budget=50000` / `max_passages=20`): the reader paginates from
 * `passages/index.json`, which carries a char count and chunk reference per passage, so
 * page boundaries are computed at read time rather than frozen into the layout.
 *
 * Everything here is pure — it takes rows and returns bytes plus checksums — so the phase
 * machine can call it one chunk at a time and hold only that chunk in memory.
 */

import { createHash } from 'node:crypto';
import type {
  AlignmentRow,
  ArtifactFileEntry,
  ChunkRange,
  GlossaryIndexEntry,
  PassageIndexEntry,
  PublishedAnnotation,
  PublishedBibliography,
  PublishedGlossaryTerm,
  PublishedPassage,
} from './types';

/** ~500KB of passage text per chunk: ~10 reader pages, well under any object limit. */
export const PASSAGE_CHUNK_CHAR_BUDGET = 500_000;
/** Backstop so a chunk of very short passages cannot grow unboundedly in row count. */
export const PASSAGE_CHUNK_MAX_ROWS = 2_000;
export const ANNOTATION_CHUNK_ROWS = 5_000;
export const GLOSSARY_CHUNK_ROWS = 5_000;
export const ALIGNMENT_CHUNK_ROWS = 5_000;

export const sha256 = (body: string): string =>
  createHash('sha256').update(body, 'utf8').digest('hex');

export const fileEntry = ({
  path,
  body,
  rowCount,
}: {
  path: string;
  body: string;
  rowCount: number;
}): ArtifactFileEntry => ({
  path,
  sha256: sha256(body),
  byteLength: Buffer.byteLength(body, 'utf8'),
  rowCount,
});

/**
 * Splits a page of passages into chunks by character budget.
 *
 * Returns whole chunks plus any trailing remainder, so the caller can carry the remainder
 * into the next page rather than emitting an undersized chunk at every page boundary —
 * page size (1000 rows) and chunk size (a character budget) are unrelated.
 *
 * A single passage larger than the budget becomes its own chunk rather than being dropped.
 */
export const splitPassagesIntoChunks = (
  passages: PublishedPassage[],
): { chunks: PublishedPassage[][]; remainder: PublishedPassage[] } => {
  const chunks: PublishedPassage[][] = [];
  let current: PublishedPassage[] = [];
  let chars = 0;

  for (const passage of passages) {
    const charCount = passage.content?.length ?? 0;

    if (
      current.length &&
      (chars + charCount > PASSAGE_CHUNK_CHAR_BUDGET ||
        current.length >= PASSAGE_CHUNK_MAX_ROWS)
    ) {
      chunks.push(current);
      current = [];
      chars = 0;
    }

    current.push(passage);
    chars += charCount;
  }

  return { chunks, remainder: current };
};

export const passageChunkBody = ({
  versionUuid,
  passages,
}: {
  versionUuid: string;
  passages: PublishedPassage[];
}): string => JSON.stringify({ versionUuid, passages });

export const annotationChunkBody = ({
  versionUuid,
  annotations,
}: {
  versionUuid: string;
  annotations: PublishedAnnotation[];
}): string => JSON.stringify({ versionUuid, annotations });

export const glossaryChunkBody = ({
  versionUuid,
  glossary,
}: {
  versionUuid: string;
  glossary: PublishedGlossaryTerm[];
}): string => JSON.stringify({ versionUuid, glossary });

export const bibliographyChunkBody = ({
  versionUuid,
  bibliographies,
}: {
  versionUuid: string;
  bibliographies: PublishedBibliography[];
}): string => JSON.stringify({ versionUuid, bibliographies });

export const alignmentChunkBody = ({
  versionUuid,
  alignments,
}: {
  versionUuid: string;
  alignments: AlignmentRow[];
}): string => JSON.stringify({ versionUuid, alignments });

/** Sort range a written passage chunk covers, used later to resolve chunkRef per passage. */
export const chunkRangeFor = ({
  path,
  passages,
}: {
  path: string;
  passages: PublishedPassage[];
}): ChunkRange => {
  const sorts = passages.map((p) => p.sort ?? 0);
  return {
    path,
    firstSort: Math.min(...sorts),
    lastSort: Math.max(...sorts),
    rowCount: passages.length,
  };
};

/**
 * Assigns each passage the chunk that holds it, by sort range.
 *
 * Ranges are disjoint and ordered because chunks were written in sort order, so a linear
 * walk is enough — no need to re-read chunk bodies to find out where a passage went.
 */
export const buildPassageIndex = ({
  rows,
  ranges,
}: {
  rows: { uuid: string; sort: number | null; type: string | null; charCount: number }[];
  ranges: ChunkRange[];
}): PassageIndexEntry[] => {
  const ordered = [...ranges].sort((a, b) => a.firstSort - b.firstSort);
  let rangeIndex = 0;

  return rows.map((row, index) => {
    const sort = row.sort ?? 0;
    while (
      rangeIndex < ordered.length - 1 &&
      sort > ordered[rangeIndex].lastSort
    ) {
      rangeIndex += 1;
    }

    return {
      sequence: index + 1,
      uuid: row.uuid,
      charCount: row.charCount,
      chunkRef: ordered[rangeIndex]?.path ?? '',
      type: row.type,
      sort: row.sort,
    };
  });
};

export const passageIndexBody = ({
  versionUuid,
  entries,
}: {
  versionUuid: string;
  entries: PassageIndexEntry[];
}): string =>
  JSON.stringify({ versionUuid, count: entries.length, passages: entries });

export const glossaryIndexBody = ({
  versionUuid,
  entries,
}: {
  versionUuid: string;
  entries: GlossaryIndexEntry[];
}): string =>
  JSON.stringify({ versionUuid, count: entries.length, terms: entries });

export const metadataBody = ({
  versionUuid,
  version,
  workUuid,
  toh,
  title,
  createdAt,
}: {
  versionUuid: string;
  version: string;
  workUuid: string;
  toh: string | null;
  title: string | null;
  createdAt: string;
}): string =>
  JSON.stringify({
    versionUuid,
    version,
    workUuid,
    toh,
    title,
    createdAt,
    /**
     * Null until CRDT sync ships. The project reserves this for the Local Persistence doc
     * versions the published rows derived from.
     */
    docVersions: null,
  });
