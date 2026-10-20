/**
 * Reads the `etexts` schema for a snapshot build: the catalog in full, and the folios one
 * volume at a time so a build never holds more than one collection's text.
 */

import type { DataClient } from '@eightyfourthousand/data-access';
import { readKeyset } from '../snapshot/paging';

/* eslint-disable-next-line @typescript-eslint/no-explicit-any */
type Query = any;

export interface EtextsCollectionRow {
  uuid: string;
  canon: string;
  rkts_id: string;
  title_en: string | null;
  title_bo: string | null;
  bdrc_id: string | null;
  num_vols: number | null;
}

export interface EtextsVolumeRow {
  uuid: string;
  collection: string;
  vol_num: number;
  bdrc_vol_id: string | null;
  rkts_text_url: string | null;
}

export interface EtextsConceptualWorkRow {
  uuid: string;
  bdrc_id: string | null;
  rkts_id: string | null;
  topic_id: string | null;
  title_bo: string | null;
  variant_title_bo: string | null;
}

export interface EtextsTohRow {
  uuid: string;
  toh: string | null;
  tohoku_catalog_no: string | null;
  conceptual_work_uuid: string | null;
}

interface FolioRef {
  folio_number: number | null;
  folio_side: string | null;
}

export interface EtextsWorkRow {
  uuid: string;
  collection_uuid: string;
  rkts_id: string | null;
  bdrc_id: string | null;
  catalogue_source: string | null;
  catalogue_id: string | null;
  tree_index: string | null;
  section_title: string | null;
  title_bo: string | null;
  title_sa: string | null;
  title_sa_wylie: string | null;
  title_en: string | null;
  conceptual_work: string | null;
  vol_start: string | null;
  vol_end: string | null;
  page_start: number | null;
  page_end: number | null;
  boundary_status: string | null;
  fs: FolioRef | null;
  fe: FolioRef | null;
}

export interface EtextsReferenceBoundaryRow {
  uuid: string;
  collection_uuid: string | null;
  toh: string | null;
  start_volume_number: number | null;
  start_folio_number: number | null;
  start_folio_side: string | null;
  start_line_number: number | null;
  start_character_position: number | null;
  end_volume_number: number | null;
  end_folio_number: number | null;
  end_folio_side: string | null;
  end_line_number: number | null;
  end_character_position: number | null;
  source: string | null;
}

export interface EtextsFolioRow {
  uuid: string;
  seq: number | null;
  folio_number: number;
  folio_side: string;
  content: string | null;
}

export interface EtextsCatalogRows {
  collections: EtextsCollectionRow[];
  volumes: EtextsVolumeRow[];
  conceptualWorks: EtextsConceptualWorkRow[];
  toh: EtextsTohRow[];
  works: EtextsWorkRow[];
  referenceBoundaries: EtextsReferenceBoundaryRow[];
  latestOcrJob: { uuid: string; publishedAt: string } | null;
}

/** What a build reads. A seam for tests. */
export interface EtextsReader {
  catalog(): Promise<EtextsCatalogRows>;
  /** A volume's folio sides in reading order. */
  folios(volumeUuid: string): Promise<EtextsFolioRow[]>;
}

const WORK_COLUMNS =
  'uuid,collection_uuid,rkts_id,bdrc_id,catalogue_source,catalogue_id,tree_index,section_title,title_bo,title_sa,title_sa_wylie,title_en,conceptual_work,vol_start,vol_end,page_start,page_end,boundary_status,fs:folios!works_folio_start_fkey(folio_number,folio_side),fe:folios!works_folio_end_fkey(folio_number,folio_side)';

const BOUNDARY_COLUMNS =
  'uuid,collection_uuid,toh,start_volume_number,start_folio_number,start_folio_side,start_line_number,start_character_position,end_volume_number,end_folio_number,end_folio_side,end_line_number,end_character_position,source';

/** Reads with `client`, which must be able to read every `etexts` table. */
export const createEtextsReader = (client: DataClient): EtextsReader => {
  const db = (client as unknown as { schema: (name: string) => Query }).schema(
    'etexts',
  );
  const all = <T extends Record<string, unknown>>(
    table: string,
    columns: string,
  ) =>
    readKeyset<T>({
      build: () => db.from(table).select(columns),
      idColumn: 'uuid',
      what: `etexts.${table}`,
    });

  return {
    catalog: async () => {
      const [
        collections,
        volumes,
        conceptualWorks,
        toh,
        works,
        referenceBoundaries,
      ] = await Promise.all([
        all<EtextsCollectionRow & Record<string, unknown>>(
          'collections',
          'uuid,canon,rkts_id,title_en,title_bo,bdrc_id,num_vols',
        ),
        all<EtextsVolumeRow & Record<string, unknown>>(
          'collection_volume',
          'uuid,collection,vol_num,bdrc_vol_id,rkts_text_url',
        ),
        all<EtextsConceptualWorkRow & Record<string, unknown>>(
          'conceptual_works',
          'uuid,bdrc_id,rkts_id,topic_id,title_bo,variant_title_bo',
        ),
        all<EtextsTohRow & Record<string, unknown>>(
          'conceptual_work_toh',
          'uuid,toh,tohoku_catalog_no,conceptual_work_uuid',
        ),
        all<EtextsWorkRow & Record<string, unknown>>('works', WORK_COLUMNS),
        all<EtextsReferenceBoundaryRow & Record<string, unknown>>(
          'reference_boundaries',
          BOUNDARY_COLUMNS,
        ),
      ]);

      const { data: jobs, error } = await db
        .from('ocr_jobs')
        .select('uuid,published_at')
        .not('published_at', 'is', null)
        .order('published_at', { ascending: false })
        .limit(1);
      if (error) {
        throw new Error(`Failed reading etexts.ocr_jobs: ${error.message}`);
      }
      const job = (jobs ?? [])[0] as
        | { uuid: string; published_at: string }
        | undefined;

      return {
        collections,
        volumes,
        conceptualWorks,
        toh,
        works,
        referenceBoundaries,
        latestOcrJob: job
          ? { uuid: job.uuid, publishedAt: job.published_at }
          : null,
      };
    },
    folios: (volumeUuid) =>
      readKeyset<EtextsFolioRow & Record<string, unknown>>({
        build: () =>
          db
            .from('folios')
            .select('uuid,seq,folio_number,folio_side,content')
            .eq('vol', volumeUuid),
        sortColumn: 'seq',
        idColumn: 'uuid',
        nullableSort: true,
        what: `etexts.folios of volume ${volumeUuid}`,
      }),
  };
};
