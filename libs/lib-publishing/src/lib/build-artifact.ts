/**
 * Artifact building.
 *
 * Chunking is char-budget driven for passages and row-count driven for the rest.
 * Chunk size is deliberately an artifact-internal detail, decoupled from the reader's
 * page size (`char_budget=50000` / `max_passages=20`): the reader paginates from
 * `passages/index.json`, which carries a char count and chunk reference per passage, so
 * page boundaries are computed at read time rather than frozen into the layout.
 */

import { createHash } from 'node:crypto';
import {
  BIBLIOGRAPHY_PATH,
  GLOSSARY_INDEX_PATH,
  METADATA_PATH,
  MANIFEST_PATH,
  PASSAGE_INDEX_PATH,
  chunkPath,
} from './artifact-keys';
import { isDeprecatedType, sanitizeAnnotation } from './sanitize';
import {
  ARTIFACT_FORMAT_VERSION,
  type ArtifactFile,
  type ArtifactManifest,
  type ArtifactSection,
  type DraftWork,
  type GlossaryIndexEntry,
  type PassageIndexEntry,
  type ValidationFinding,
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

const json = (value: unknown): string => JSON.stringify(value);

/** Splits by row count, preserving input order. */
const byRows = <T>(rows: T[], size: number): T[][] => {
  if (!rows.length) return [];
  const chunks: T[][] = [];
  for (let index = 0; index < rows.length; index += size) {
    chunks.push(rows.slice(index, index + size));
  }
  return chunks;
};

export interface BuiltArtifact {
  files: ArtifactFile[];
  manifest: ArtifactManifest;
  manifestHash: string;
  counts: Record<ArtifactSection, number>;
}

export const buildArtifact = ({
  draft,
  versionUuid,
  version,
  createdAt,
  warnings,
}: {
  draft: DraftWork;
  versionUuid: string;
  version: string;
  createdAt: string;
  warnings: ValidationFinding[];
}): BuiltArtifact => {
  const files: ArtifactFile[] = [];

  // Passages, in published reading order. Ordering is validated upstream, so a null
  // sort cannot reach here; the comparison keeps sorting total regardless.
  const passages = [...draft.passages].sort(
    (a, b) => (a.sort ?? 0) - (b.sort ?? 0),
  );

  const passageIndex: PassageIndexEntry[] = [];
  let currentChunk: typeof passages = [];
  let currentChars = 0;
  let chunkNumber = 1;
  let sequence = 0;

  const flushPassages = () => {
    if (!currentChunk.length) return;
    const path = chunkPath('passages', chunkNumber);
    files.push({
      path,
      body: json({ versionUuid, passages: currentChunk }),
      rowCount: currentChunk.length,
    });
    chunkNumber += 1;
    currentChunk = [];
    currentChars = 0;
  };

  for (const passage of passages) {
    const charCount = passage.content?.length ?? 0;

    // Flush before adding when this passage would exceed the budget, so a chunk never
    // overshoots — except when it is the first passage in the chunk, which must go
    // somewhere even if it alone exceeds the budget.
    if (
      currentChunk.length &&
      (currentChars + charCount > PASSAGE_CHUNK_CHAR_BUDGET ||
        currentChunk.length >= PASSAGE_CHUNK_MAX_ROWS)
    ) {
      flushPassages();
    }

    sequence += 1;
    passageIndex.push({
      sequence,
      uuid: passage.uuid,
      charCount,
      chunkRef: chunkPath('passages', chunkNumber),
      type: passage.type,
      sort: passage.sort,
    });

    currentChunk.push(passage);
    currentChars += charCount;
  }
  flushPassages();

  files.push({
    path: PASSAGE_INDEX_PATH,
    body: json({ versionUuid, count: passageIndex.length, passages: passageIndex }),
    rowCount: passageIndex.length,
  });

  // Annotations. Deprecated types are excluded (the reader already filters them) and
  // *_xmlId keys are stripped, so the published layer is UUID-only.
  const passageOrder = new Map(
    passageIndex.map((entry) => [entry.uuid, entry.sequence]),
  );
  const annotations = draft.annotations
    .filter((annotation) => !isDeprecatedType(annotation.type))
    .map(sanitizeAnnotation)
    .sort((a, b) => {
      const orderA = passageOrder.get(a.passage_uuid) ?? 0;
      const orderB = passageOrder.get(b.passage_uuid) ?? 0;
      if (orderA !== orderB) return orderA - orderB;
      if (a.start !== b.start) return a.start - b.start;
      return b.end - a.end;
    });

  byRows(annotations, ANNOTATION_CHUNK_ROWS).forEach((rows, index) => {
    files.push({
      path: chunkPath('annotations', index + 1),
      body: json({ versionUuid, annotations: rows }),
      rowCount: rows.length,
    });
  });

  // Glossary, from the glossary_term_index output shape, ordered by term_number.
  const glossary = [...draft.glossary].sort(
    (a, b) => (a.term_number ?? 0) - (b.term_number ?? 0),
  );
  const glossaryChunks = byRows(glossary, GLOSSARY_CHUNK_ROWS);
  const glossaryIndex: GlossaryIndexEntry[] = [];

  glossaryChunks.forEach((rows, index) => {
    const path = chunkPath('glossary', index + 1);
    files.push({
      path,
      body: json({ versionUuid, glossary: rows }),
      rowCount: rows.length,
    });
    for (const term of rows) {
      glossaryIndex.push({
        glossaryUuid: term.glossary_uuid,
        termNumber: term.term_number,
        chunkRef: path,
      });
    }
  });

  files.push({
    path: GLOSSARY_INDEX_PATH,
    body: json({ versionUuid, count: glossaryIndex.length, terms: glossaryIndex }),
    rowCount: glossaryIndex.length,
  });

  const bibliographies = [...draft.bibliographies].sort(
    (a, b) => (a.sort ?? 0) - (b.sort ?? 0),
  );
  files.push({
    path: BIBLIOGRAPHY_PATH,
    body: json({ versionUuid, bibliographies }),
    rowCount: bibliographies.length,
  });

  // Alignments are carried for archival completeness only: they are not materialized
  // into a published table (they change very rarely, so they stay unversioned like
  // authorities and the reader keeps reading the draft table). Including them here
  // costs little and means closing that gap later needs no republish.
  byRows(draft.alignments, ALIGNMENT_CHUNK_ROWS).forEach((rows, index) => {
    files.push({
      path: chunkPath('alignments', index + 1),
      body: json({ versionUuid, alignments: rows }),
      rowCount: rows.length,
    });
  });

  files.push({
    path: METADATA_PATH,
    body: json({
      versionUuid,
      version,
      workUuid: draft.workUuid,
      toh: draft.toh,
      title: draft.title,
      createdAt,
      /**
       * Null until CRDT sync ships. The project reserves this for the Local Persistence
       * doc versions the published rows derived from.
       */
      docVersions: null,
    }),
    rowCount: 1,
  });

  const counts: Record<ArtifactSection, number> = {
    passages: passages.length,
    annotations: annotations.length,
    glossary: glossary.length,
    bibliography: bibliographies.length,
    alignments: draft.alignments.length,
    metadata: 1,
  };

  const manifest: ArtifactManifest = {
    formatVersion: ARTIFACT_FORMAT_VERSION,
    workUuid: draft.workUuid,
    toh: draft.toh,
    versionUuid,
    version,
    createdAt,
    files: files
      .map((file) => ({
        path: file.path,
        sha256: sha256(file.body),
        byteLength: Buffer.byteLength(file.body, 'utf8'),
        rowCount: file.rowCount,
      }))
      // Stable order so the manifest hash is deterministic for identical input.
      .sort((a, b) => a.path.localeCompare(b.path)),
    counts,
    warnings,
  };

  const manifestBody = JSON.stringify(manifest, null, 2);

  return {
    files: [
      ...files,
      { path: MANIFEST_PATH, body: manifestBody, rowCount: 1 },
    ],
    manifest,
    manifestHash: sha256(manifestBody),
    counts,
  };
};
