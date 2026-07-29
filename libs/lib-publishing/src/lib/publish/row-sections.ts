/**
 * Writing one chunk of a row-count-chunked artifact section.
 *
 * Passages are chunked by character budget and handled by the artifact phase itself;
 * annotations, glossary, bibliography, and alignments are chunked by row count, which is
 * uniform enough to express as a single step the phase can call in a loop.
 */

import type { DataClient } from '@eightyfourthousand/data-access';
import { BIBLIOGRAPHY_PATH, chunkPath } from '../artifact-keys';
import { uploadArtifactFile } from '../artifact-storage';
import {
  PAGE_SIZE,
  readAlignmentPage,
  readAnnotationPage,
  readBibliographyPage,
  readGlossaryPage,
} from '../read-published';
import {
  ALIGNMENT_CHUNK_ROWS,
  ANNOTATION_CHUNK_ROWS,
  GLOSSARY_CHUNK_ROWS,
  alignmentChunkBody,
  annotationChunkBody,
  bibliographyChunkBody,
  fileEntry,
  glossaryChunkBody,
} from '../serialize';
import type { ArtifactCursor, ArtifactFileEntry } from '../types';

/** One page-sized chunk of a row-count-chunked section. */
export const writeRowSection = async ({
  client,
  root,
  versionUuid,
  workUuid,
  cursor,
}: {
  client: DataClient;
  root: string;
  versionUuid: string;
  workUuid: string;
  cursor: ArtifactCursor;
}): Promise<{
  files: ArtifactFileEntry[];
  exhausted: boolean;
  offset: number;
  chunk: number;
}> => {
  const files: ArtifactFileEntry[] = [];

  if (cursor.section === 'annotations') {
    const rows = await readAnnotationPage({
      client,
      versionUuid,
      offset: cursor.offset,
      limit: ANNOTATION_CHUNK_ROWS,
    });
    if (rows.length) {
      const path = chunkPath('annotations', cursor.chunk);
      const body = annotationChunkBody({ versionUuid, annotations: rows });
      await uploadArtifactFile({ client, root, path, body });
      files.push(fileEntry({ path, body, rowCount: rows.length }));
    }
    return {
      files,
      exhausted: rows.length < ANNOTATION_CHUNK_ROWS,
      offset: cursor.offset + rows.length,
      chunk: cursor.chunk + 1,
    };
  }

  if (cursor.section === 'glossary') {
    const rows = await readGlossaryPage({
      client,
      versionUuid,
      offset: cursor.offset,
      limit: GLOSSARY_CHUNK_ROWS,
    });
    if (rows.length) {
      const path = chunkPath('glossary', cursor.chunk);
      const body = glossaryChunkBody({ versionUuid, glossary: rows });
      await uploadArtifactFile({ client, root, path, body });
      files.push(fileEntry({ path, body, rowCount: rows.length }));
    }
    return {
      files,
      exhausted: rows.length < GLOSSARY_CHUNK_ROWS,
      offset: cursor.offset + rows.length,
      chunk: cursor.chunk + 1,
    };
  }

  if (cursor.section === 'bibliography') {
    // Bibliographies are small enough to be a single object rather than chunks, matching
    // the artifact layout the project specified.
    const rows = await readBibliographyPage({
      client,
      versionUuid,
      offset: 0,
      limit: PAGE_SIZE,
    });
    const body = bibliographyChunkBody({ versionUuid, bibliographies: rows });
    await uploadArtifactFile({ client, root, path: BIBLIOGRAPHY_PATH, body });
    files.push(
      fileEntry({ path: BIBLIOGRAPHY_PATH, body, rowCount: rows.length }),
    );
    return { files, exhausted: true, offset: rows.length, chunk: cursor.chunk };
  }

  // Alignments: archival only, and absent entirely when the source view is unpopulated.
  const rows = await readAlignmentPage({
    client,
    workUuid,
    offset: cursor.offset,
    limit: ALIGNMENT_CHUNK_ROWS,
  });
  if (rows.length) {
    const path = chunkPath('alignments', cursor.chunk);
    const body = alignmentChunkBody({ versionUuid, alignments: rows });
    await uploadArtifactFile({ client, root, path, body });
    files.push(fileEntry({ path, body, rowCount: rows.length }));
  }
  return {
    files,
    exhausted: rows.length < ALIGNMENT_CHUNK_ROWS,
    offset: cursor.offset + rows.length,
    chunk: cursor.chunk + 1,
  };
};
