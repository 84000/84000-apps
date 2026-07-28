/**
 * Artifact object keys.
 *
 * Keys are immutable: once a `work_versions` row exists they are never overwritten, so
 * publishing a correction means publishing a new version. That is what makes Supabase
 * object versioning unnecessary and lets any past version be re-materialized verbatim.
 */

export const artifactRoot = ({
  workUuid,
  versionUuid,
}: {
  workUuid: string;
  versionUuid: string;
}): string => `${workUuid}/versions/${versionUuid}`;

export const MANIFEST_PATH = 'manifest.json';
export const PASSAGE_INDEX_PATH = 'passages/index.json';
export const GLOSSARY_INDEX_PATH = 'glossary/index.json';
export const BIBLIOGRAPHY_PATH = 'bibliography.json';
export const METADATA_PATH = 'metadata.json';

/** Chunk paths are 1-based and zero-padded so lexical order matches sequence order. */
export const chunkPath = (
  section: 'passages' | 'annotations' | 'glossary' | 'alignments',
  index: number,
): string => `${section}/chunk-${String(index).padStart(4, '0')}.json`;

export const objectKey = ({
  root,
  path,
}: {
  root: string;
  path: string;
}): string => `${root}/${path}`;
