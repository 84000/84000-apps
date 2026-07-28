/**
 * Materializing `published_*` rows FROM a version artifact — the REPAIR path.
 *
 * Publishing no longer comes through here: `snapshot_work_version` copies draft rows
 * inside Postgres, because shipping ~390k rows through a serverless function is not
 * viable. This module is what makes the artifact canonical for *reconstruction*: given
 * any version's artifact it rebuilds that version's rows exactly, verifying each chunk
 * against the manifest checksum on the way in.
 *
 * Nothing here touches the live version by itself. `published_*` are keyed on
 * (version_uuid, <domain uuid>), so rows written for one version sit alongside whatever
 * is serving; only a pointer flip makes them live.
 *
 * Scale note: for a large work this inserts ~390k rows in batches, which is CLI-scale
 * work rather than something to run inside one Vercel invocation. Rebuild is an
 * engineer-initiated repair, so it is driven from `node-scripts` rather than the publish
 * job machinery; ticking it would be a follow-up if it ever needs to run from the UI.
 */

import type { DataClient } from '@eightyfourthousand/data-access';
import {
  BIBLIOGRAPHY_PATH,
  PASSAGE_INDEX_PATH,
} from './artifact-keys';
import { readArtifactFile, sectionPaths } from './artifact-storage';
import type {
  ArtifactManifest,
  PublishedAnnotation,
  PublishedBibliography,
  PublishedGlossaryTerm,
  PublishedPassage,
} from './types';

/** Rows per insert. Keeps request bodies well inside PostgREST limits. */
const INSERT_BATCH = 500;

/**
 * `table` is a runtime string, so supabase-js cannot resolve a row type for it and the
 * insert payload is cast. Row shapes are pinned by the call sites below instead.
 */
const insertBatches = async ({
  client,
  table,
  rows,
}: {
  client: DataClient;
  table: string;
  rows: Record<string, unknown>[];
}): Promise<number> => {
  for (let index = 0; index < rows.length; index += INSERT_BATCH) {
    const batch = rows.slice(index, index + INSERT_BATCH);
    const { error } = await client.from(table).insert(batch as never);
    if (error) {
      throw new Error(
        `Failed inserting into ${table} (rows ${index}-${index + batch.length - 1}): ` +
          JSON.stringify(error),
      );
    }
  }
  return rows.length;
};

export interface MaterializeCounts {
  passages: number;
  annotations: number;
  glossary: number;
  bibliographies: number;
}

/**
 * Inserts a version's snapshot rows, reading each artifact chunk in turn.
 *
 * Chunks are processed one at a time rather than all loaded first: the largest work
 * carries ~374k annotations, and holding every chunk in memory before inserting any
 * would be needless peak usage.
 */
export const materializeVersion = async ({
  client,
  root,
  manifest,
  workUuid,
  versionUuid,
}: {
  client: DataClient;
  root: string;
  manifest: ArtifactManifest;
  workUuid: string;
  versionUuid: string;
}): Promise<MaterializeCounts> => {
  const counts: MaterializeCounts = {
    passages: 0,
    annotations: 0,
    glossary: 0,
    bibliographies: 0,
  };

  // Passages first: annotations carry a foreign key to (version_uuid, passage_uuid).
  for (const path of sectionPaths(manifest, 'passages')) {
    const chunk = await readArtifactFile<{ passages: PublishedPassage[] }>({
      client,
      root,
      path,
      manifest,
    });

    // content_tsv and search_tsv are generated columns that repeat the draft table's
    // expressions verbatim, so they are deliberately not written here.
    counts.passages += await insertBatches({
      client,
      table: 'published_passages',
      rows: chunk.passages.map((passage) => ({
        uuid: passage.uuid,
        work_uuid: workUuid,
        version_uuid: versionUuid,
        content: passage.content,
        label: passage.label,
        sort: passage.sort,
        parent: passage.parent,
        type: passage.type,
        toh: passage.toh,
      })),
    });
  }

  for (const path of sectionPaths(manifest, 'annotations')) {
    const chunk = await readArtifactFile<{ annotations: PublishedAnnotation[] }>({
      client,
      root,
      path,
      manifest,
    });

    counts.annotations += await insertBatches({
      client,
      table: 'published_passage_annotations',
      rows: chunk.annotations.map((annotation) => ({
        uuid: annotation.uuid,
        passage_uuid: annotation.passage_uuid,
        work_uuid: workUuid,
        version_uuid: versionUuid,
        type: annotation.type,
        start: annotation.start,
        end: annotation.end,
        content: annotation.content,
        toh: annotation.toh,
      })),
    });
  }

  for (const path of sectionPaths(manifest, 'glossary')) {
    const chunk = await readArtifactFile<{ glossary: PublishedGlossaryTerm[] }>({
      client,
      root,
      path,
      manifest,
    });

    // search_tsv is generated; search_text / *_sort are plain snapshotted columns
    // because the view builds them with STABLE functions.
    counts.glossary += await insertBatches({
      client,
      table: 'published_glossaries',
      rows: chunk.glossary.map((term) => ({
        glossary_uuid: term.glossary_uuid,
        authority_uuid: term.authority_uuid,
        work_uuid: workUuid,
        version_uuid: versionUuid,
        headword: term.headword,
        headword_language: term.headword_language,
        english: term.english,
        wylie: term.wylie,
        tibetan: term.tibetan,
        sanskrit_plain: term.sanskrit_plain,
        sanskrit_attested: term.sanskrit_attested,
        chinese: term.chinese,
        pali: term.pali,
        alternatives: term.alternatives,
        definition: term.definition,
        english_sort: term.english_sort,
        headword_sort: term.headword_sort,
        term_number: term.term_number,
        search_text: term.search_text,
      })),
    });
  }

  const bibliography = await readArtifactFile<{
    bibliographies: PublishedBibliography[];
  }>({ client, root, path: BIBLIOGRAPHY_PATH, manifest });

  counts.bibliographies += await insertBatches({
    client,
    table: 'published_bibliographies',
    rows: bibliography.bibliographies.map((entry) => ({
      uuid: entry.uuid,
      work_uuid: workUuid,
      version_uuid: versionUuid,
      bibl_html: entry.bibl_html,
      sort: entry.sort,
      heading: entry.heading,
      is_heading: entry.is_heading,
      heading_uuid: entry.heading_uuid,
      toh: entry.toh,
    })),
  });

  return counts;
};

/**
 * Confirms the materialized rows match the artifact before anything goes live.
 *
 * This is the step the version-scoped keys buy: verification happens while the new
 * version is still invisible, so a mismatch aborts the publish instead of being
 * discovered after readers are already served from it.
 */
export const verifyMaterialized = async ({
  client,
  manifest,
  versionUuid,
}: {
  client: DataClient;
  manifest: ArtifactManifest;
  versionUuid: string;
}): Promise<{ ok: boolean; mismatches: string[] }> => {
  const passageIndex = manifest.files.find(
    (file) => file.path === PASSAGE_INDEX_PATH,
  );

  const expected: Record<string, number> = {
    published_passages: passageIndex?.rowCount ?? manifest.counts.passages,
    published_passage_annotations: manifest.counts.annotations,
    published_glossaries: manifest.counts.glossary,
    published_bibliographies: manifest.counts.bibliography,
  };

  const mismatches: string[] = [];

  for (const [table, want] of Object.entries(expected)) {
    const { count, error } = await client
      .from(table)
      .select('*', { count: 'exact', head: true })
      .eq('version_uuid', versionUuid);

    if (error) {
      mismatches.push(`${table}: count failed (${JSON.stringify(error)})`);
      continue;
    }
    if ((count ?? 0) !== want) {
      mismatches.push(`${table}: expected ${want} rows, found ${count ?? 0}`);
    }
  }

  return { ok: mismatches.length === 0, mismatches };
};

/** Removes one version's snapshot rows. Used to retire the old version and to clean up. */
export const deleteVersionRows = async ({
  client,
  versionUuid,
}: {
  client: DataClient;
  versionUuid: string;
}): Promise<void> => {
  // Annotations first: they hold a cascade FK to published_passages. The cascade would
  // handle it, but deleting explicitly keeps the intent obvious and the order safe if
  // that FK ever changes.
  for (const table of [
    'published_passage_annotations',
    'published_passages',
    'published_glossaries',
    'published_bibliographies',
  ]) {
    const { error } = await client
      .from(table)
      .delete()
      .eq('version_uuid', versionUuid);

    if (error) {
      throw new Error(
        `Failed deleting ${table} rows for version ${versionUuid}: ${JSON.stringify(error)}`,
      );
    }
  }
};
