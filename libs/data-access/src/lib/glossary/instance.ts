import {
  DataClient,
  GlossaryTermInstance,
  GlossaryTermInstanceDTO,
  GlossaryTermInstancesDTO,
  glossaryTermInstanceFromDTO,
} from '../types';
import {
  DEFAULT_CONTENT_SOURCE,
  relationFor,
  type ContentSource,
} from '../content-source';

const GLOSSARY_INDEX_COLUMNS =
  'glossary_uuid, authority_uuid, work_uuid, definition, english, wylie, tibetan, sanskrit_plain, chinese, pali, alternatives';

type GlossaryTermIndexInstanceRow = {
  glossary_uuid: string;
  authority_uuid: string;
  work_uuid: string;
  definition: string | null;
  english: string | null;
  wylie: string | null;
  tibetan: string | null;
  sanskrit_plain: string | null;
  chinese: string | null;
  pali: string | null;
  alternatives: string | null;
};

const indexRowToDTO = (
  row: GlossaryTermIndexInstanceRow,
): GlossaryTermInstanceDTO => ({
  uuid: row.glossary_uuid,
  authority_uuid: row.authority_uuid,
  work_uuid: row.work_uuid,
  definition: row.definition ?? undefined,
  names: {
    english: row.english ?? undefined,
    tibetan: row.tibetan ?? undefined,
    sanskrit: row.sanskrit_plain ?? undefined,
    pali: row.pali ?? undefined,
    chinese: row.chinese ?? undefined,
    wylie: row.wylie ?? undefined,
    alternatives: row.alternatives ?? undefined,
  },
});

const byEnglishName = (a: GlossaryTermInstance, b: GlossaryTermInstance) =>
  (a.names.english || '').localeCompare(b.names.english || '');

/** PostgREST truncates a read at 1000 rows without an error. */
const PUBLISHED_PAGE_ROWS = 1000;

/** Reads a work's published glossary terms a page at a time; [] on error. */
const fetchPublishedTerms = async (client: DataClient, workUuid: string) => {
  const rows: GlossaryTermIndexInstanceRow[] = [];
  for (let from = 0; ; from += PUBLISHED_PAGE_ROWS) {
    const { data, error } = await client
      .from(relationFor('glossaryTerms', 'published'))
      .select(GLOSSARY_INDEX_COLUMNS)
      .eq('work_uuid', workUuid)
      .order('glossary_uuid')
      .range(from, from + PUBLISHED_PAGE_ROWS - 1);
    if (error) {
      console.error(
        `Error fetching published glossary instances for work: ${workUuid} `,
        error,
      );
      return [];
    }
    const page = (data ?? []) as GlossaryTermIndexInstanceRow[];
    rows.push(...page);
    if (page.length < PUBLISHED_PAGE_ROWS) return rows;
  }
};

/**
 * A work's glossary terms, sorted by English name. The published source reads
 * the published snapshot; only the draft source reads the draft glossary
 * tables (through `show_glossary_entries`), which need editor.read.
 */
export const getGlossaryInstances = async ({
  client,
  uuid,
  withAttestations = false,
  source = DEFAULT_CONTENT_SOURCE,
}: {
  client: DataClient;
  uuid: string;
  withAttestations?: boolean;
  source?: ContentSource;
}): Promise<GlossaryTermInstance[]> => {
  if (source === 'published') {
    const rows = await fetchPublishedTerms(client, uuid);
    return rows
      .map((row) => glossaryTermInstanceFromDTO(indexRowToDTO(row)))
      .sort(byEnglishName);
  }

  const { data, error } = await client.rpc('show_glossary_entries', {
    v_work_uuid: uuid,
    v_with_attestation: withAttestations,
  });
  if (error) {
    console.error(
      `Error fetching glossary instances for work: ${uuid} `,
      error,
    );
    return [];
  }

  const dto = data as GlossaryTermInstancesDTO;
  return dto.glossary_entries
    .map(glossaryTermInstanceFromDTO)
    .sort(byEnglishName);
};

const fetchIndexRow = async (
  client: DataClient,
  uuid: string,
  source: ContentSource,
) => {
  const { data, error } =
    source === 'draft'
      ? await client
          .rpc('glossary_term_by_uuid', { p_glossary_uuid: uuid })
          .maybeSingle()
      : await client
          .from(relationFor('glossaryTerms', source))
          .select(GLOSSARY_INDEX_COLUMNS)
          .eq('glossary_uuid', uuid)
          .limit(1)
          .maybeSingle();
  if (error) {
    console.error(`Error fetching glossary instance: ${uuid} `, error);
    return null;
  }
  return data as GlossaryTermIndexInstanceRow | null;
};

export const getGlossaryInstance = async ({
  client,
  uuid,
  source = DEFAULT_CONTENT_SOURCE,
}: {
  client: DataClient;
  uuid: string;
  source?: ContentSource;
}) => {
  // 1) Direct lookup of the term (the published snapshot mirrors its shape).
  let row = await fetchIndexRow(client, uuid, source);

  // 2) Draft only: the uuid may be a non-translationMain child that isn't a
  //    term of its own. Resolve its parent via glossary_edges and retry with the
  //    parent uuid. The published source never reads glossary_edges (it needs
  //    editor.read), so a child uuid is not found there.
  if (!row && source === 'draft') {
    const { data: edge, error: edgeError } = await client
      .from('glossary_edges')
      .select('parent_uuid')
      .eq('child_uuid', uuid)
      .limit(1)
      .maybeSingle();
    if (edgeError) {
      console.error(`Error fetching glossary edge: ${uuid} `, edgeError);
    } else if (edge?.parent_uuid) {
      row = await fetchIndexRow(client, edge.parent_uuid, source);
    }
  }

  if (!row) {
    return undefined;
  }

  return glossaryTermInstanceFromDTO(indexRowToDTO(row));
};
