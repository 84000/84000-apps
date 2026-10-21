/**
 * Reads a work's rows from its draft or from its live published version, one relation
 * at a time, in the shapes the snapshot parts render.
 *
 * Published reads go to the version-scoped `published_*` rows of the version that is
 * live when the work resolves. A later publish deletes those rows after it flips the
 * pointer, so a caller confirms with `isPublishedVersionLive` once its reads are done.
 */

import {
  DRAFT_ONLY_ANNOTATIONS,
  type ContentSource,
  type DataClient,
} from '@eightyfourthousand/data-access';
import type {
  PublishedAnnotation,
  PublishedBibliography,
  PublishedPassage,
} from '../types';
import {
  glossaryTermOf,
  readDraftGlossary,
  type DraftGlossary,
  type GlossaryEdgeRow,
} from './glossary';
import { fail, readByIn, readKeyset } from './paging';
import {
  readDraftAnnotations,
  readDraftBibliographies,
  readDraftPassages,
  resolveDraftWork,
  type DraftWork,
} from './read-draft';
import type { PublishedGlossaryTerm } from '../types';

/** A work resolved for one source. */
export interface SourceWork extends DraftWork {
  source: ContentSource;
  /** The live published version, for `published`; null for `draft`. */
  versionUuid: string | null;
}

export type ResolveSourceWorkResult =
  | { status: 'ok'; work: SourceWork }
  | { status: 'not-found' }
  /** The work exists but has no live published version. */
  | { status: 'unpublished'; work: DraftWork };

/** Resolves a Toh or work uuid, and for `published` its live version. */
export const resolveSourceWork = async ({
  client,
  work,
  source,
}: {
  client: DataClient;
  work: string;
  source: ContentSource;
}): Promise<ResolveSourceWorkResult> => {
  const draft = await resolveDraftWork({ client, work });
  if (!draft) return { status: 'not-found' };
  if (source === 'draft') {
    return {
      status: 'ok',
      work: { ...draft, source, versionUuid: null },
    };
  }
  const { data, error } = await client
    .from('works')
    .select('published_version_uuid')
    .eq('uuid', draft.uuid)
    .maybeSingle();
  if (error) fail('published version', error);
  const versionUuid: string | null = data?.published_version_uuid ?? null;
  if (!versionUuid) return { status: 'unpublished', work: draft };
  return { status: 'ok', work: { ...draft, source, versionUuid } };
};

/**
 * Whether `work`'s version is still the live one. Rows read before a publish replaced
 * it may be incomplete, since the previous version's rows are deleted after the flip.
 */
export const isPublishedVersionLive = async (
  client: DataClient,
  work: SourceWork,
): Promise<boolean> => {
  const { data, error } = await client
    .from('works')
    .select('published_version_uuid')
    .eq('uuid', work.uuid)
    .maybeSingle();
  if (error) fail('published version', error);
  return (
    !!work.versionUuid && data?.published_version_uuid === work.versionUuid
  );
};

const published = (work: SourceWork): string => {
  if (!work.versionUuid) {
    throw new Error(`Work ${work.uuid} has no published version to read`);
  }
  return work.versionUuid;
};

/** The work's passages in reading order: sort, then uuid, unsorted last. */
export const readSourcePassages = (
  client: DataClient,
  work: SourceWork,
): Promise<PublishedPassage[]> => {
  if (work.source === 'draft') return readDraftPassages(client, work.uuid);
  const version = published(work);
  return readKeyset<PublishedPassage & Record<string, unknown>>({
    build: () =>
      client
        .from('published_passages')
        .select('uuid, work_uuid, content, label, sort, parent, type, toh')
        .eq('work_uuid', work.uuid)
        .eq('version_uuid', version),
    sortColumn: 'sort',
    idColumn: 'uuid',
    nullableSort: true,
    what: 'published passages',
  });
};

/**
 * Annotations of the work's passages, narrowed to `types` when given. A draft read
 * keeps every type; a published read never returns draft-only types.
 */
export const readSourceAnnotations = async (
  client: DataClient,
  work: SourceWork,
  passageUuids: readonly string[],
  types?: readonly string[],
): Promise<PublishedAnnotation[]> => {
  if (work.source === 'draft') {
    return readDraftAnnotations(client, work.uuid, passageUuids, types);
  }
  const version = published(work);
  const rows = await readKeyset<PublishedAnnotation & Record<string, unknown>>({
    build: () => {
      let query = client
        .from('published_passage_annotations')
        .select('uuid, passage_uuid, work_uuid, type, start, end, content, toh')
        .eq('version_uuid', version)
        .not('type', 'in', `(${DRAFT_ONLY_ANNOTATIONS.join(',')})`);
      if (types) query = query.in('type', [...types]);
      return query;
    },
    idColumn: 'uuid',
    what: 'published annotations',
  });
  const wanted = new Set(passageUuids);
  return rows.filter((a) => wanted.has(a.passage_uuid));
};

/** The work's glossary terms in term order, and which term each glossary uuid cites. */
export const readSourceGlossary = async (
  client: DataClient,
  work: SourceWork,
): Promise<DraftGlossary> => {
  if (work.source === 'draft') {
    return readDraftGlossary({ client, workUuid: work.uuid });
  }
  const version = published(work);
  const terms = await readKeyset<
    PublishedGlossaryTerm & Record<string, unknown>
  >({
    build: () =>
      client
        .from('published_glossaries')
        .select(
          'glossary_uuid, authority_uuid, work_uuid, headword, headword_language, english, ' +
            'wylie, tibetan, sanskrit_plain, sanskrit_attested, chinese, pali, alternatives, ' +
            'definition, english_sort, headword_sort, term_number, search_text',
        )
        .eq('work_uuid', work.uuid)
        .eq('version_uuid', version),
    sortColumn: 'term_number',
    idColumn: 'glossary_uuid',
    nullableSort: true,
    what: 'published glossary',
  });
  // Instances may cite a term's other names; edges are not versioned, as publish's own
  // check resolves them.
  const edges = await readByIn<GlossaryEdgeRow & Record<string, unknown>>({
    client,
    table: 'glossary_edges',
    columns: 'parent_uuid, child_uuid',
    column: 'parent_uuid',
    values: terms.map((t) => t.glossary_uuid),
    sortColumn: 'parent_uuid',
    idColumn: 'child_uuid',
    what: 'published glossary edges',
  });
  return { terms, termOf: glossaryTermOf(terms, edges) };
};

/** The work's bibliography, in order. */
export const readSourceBibliographies = (
  client: DataClient,
  work: SourceWork,
): Promise<PublishedBibliography[]> => {
  if (work.source === 'draft')
    return readDraftBibliographies(client, work.uuid);
  const version = published(work);
  return readKeyset<PublishedBibliography & Record<string, unknown>>({
    build: () =>
      client
        .from('published_bibliographies')
        .select(
          'uuid, work_uuid, bibl_html, sort, heading, is_heading, heading_uuid, toh',
        )
        .eq('work_uuid', work.uuid)
        .eq('version_uuid', version),
    sortColumn: 'sort',
    idColumn: 'uuid',
    nullableSort: true,
    what: 'published bibliographies',
  });
};
