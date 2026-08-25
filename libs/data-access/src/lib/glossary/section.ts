import { DataClient, TohokuCatalogEntry } from '../types';
import {
  DEFAULT_CONTENT_SOURCE,
  rpcFor,
  type ContentSource,
} from '../content-source';
import { getWorkRefsByUuids, type WorkRef } from '../publications';
import {
  GlossaryTermIndexRow,
  GlossaryTermNode,
  rowToGlossaryTermNode,
} from './pagination';

const DEFAULT_SEARCH_LIMIT = 50;
const MAX_SEARCH_LIMIT = 200;

/**
 * The headword and its language come from the same row but are not part of
 * `GlossaryTermNode`, which is shared with the reader and GraphQL surfaces.
 * Carrying them alongside keeps that type untouched.
 */
export type CanonSectionGlossaryTerm = GlossaryTermNode & {
  headword: string | null;
  headwordLanguage: string | null;
};

/**
 * One work's glossary entries for the searched term.
 *
 * Grouped per work rather than returned flat: the same term is routinely glossed
 * more than once within a single translation — a Sanskrit-language and an
 * English-language name row can point at one authority — so a flat list reads as
 * duplicates and leaves the caller to collapse them.
 */
export type CanonSectionGlossaryWork = {
  work: WorkRef;
  terms: CanonSectionGlossaryTerm[];
};

type SectionGlossaryRow = GlossaryTermIndexRow & {
  work_uuid: string;
  headword: string | null;
  headword_language: string | null;
};

const SEARCH_COLUMNS = `work_uuid,
   glossary_uuid,
   authority_uuid,
   term_number,
   definition,
   headword,
   headword_language,
   english,
   wylie,
   tibetan,
   sanskrit_plain,
   sanskrit_attested,
   chinese,
   pali,
   alternatives`;

const escapeIlike = (input: string) =>
  input.replace(/\\/g, '\\\\').replace(/%/g, '\\%').replace(/_/g, '\\_');

/**
 * Sort key for a work's first Tohoku number.
 *
 * Tohoku numbers are stored as text (`toh251`), so a lexicographic sort puts
 * `toh1000` before `toh251`. Ordering by the numeric part restores catalog order,
 * which is how these results are read.
 */
const tohSortKey = (work: WorkRef): number => {
  const [first] = work.toh;
  const digits = first?.replace(/^toh/, '') ?? '';
  const parsed = Number.parseInt(digits, 10);
  return Number.isFinite(parsed) ? parsed : Number.MAX_SAFE_INTEGER;
};

/**
 * Search glossary terms across every work in a canonical section of the
 * Kangyur/Tengyur.
 *
 * The section-scoped counterpart of {@link searchWorkGlossaryTerms}, for the
 * escalation a translator makes when a term is not glossed in the work being
 * drafted: check how the canon-section neighbours gloss it. Matching, term
 * ordering and the row shape are the per-work search's, so the two agree.
 *
 * Reads the published snapshot by default. A glossary entry located this way is
 * binding on the translator, and what binds is the published house rendering
 * rather than a term still under editorial review; `source: 'draft'` opts into
 * in-progress glossaries deliberately.
 */
export const searchCanonSectionGlossaryTerms = async ({
  client,
  sectionUuid,
  query,
  limit = DEFAULT_SEARCH_LIMIT,
  includeDescendants = true,
  withAttestations = false,
  source = DEFAULT_CONTENT_SOURCE,
}: {
  client: DataClient;
  sectionUuid: string;
  query: string;
  limit?: number;
  includeDescendants?: boolean;
  withAttestations?: boolean;
  source?: ContentSource;
}): Promise<CanonSectionGlossaryWork[]> => {
  const trimmed = query.trim();
  if (!trimmed) {
    return [];
  }

  const clampedLimit = Math.min(Math.max(limit, 1), MAX_SEARCH_LIMIT);

  const { data, error } = await client
    .rpc(rpcFor('sectionGlossarySearch', source), {
      p_section_uuid: sectionUuid,
      p_pattern: escapeIlike(trimmed),
      p_limit: clampedLimit,
      p_include_descendants: includeDescendants,
    })
    .select(SEARCH_COLUMNS);

  if (error) {
    console.error(`Failed to search section glossary terms: ${error.message}`);
    return [];
  }

  const rows = (data ?? []) as SectionGlossaryRow[];
  if (rows.length === 0) {
    return [];
  }

  const workRefs = await getWorkRefsByUuids({
    client,
    uuids: [...new Set(rows.map((row) => row.work_uuid))],
  });

  const byWork = new Map<string, CanonSectionGlossaryWork>();
  for (const row of rows) {
    const existing = byWork.get(row.work_uuid);
    const group =
      existing ??
      ({
        work: workRefs.get(row.work_uuid) ?? {
          uuid: row.work_uuid,
          title: '<Untitled>',
          toh: [] as TohokuCatalogEntry[],
        },
        terms: [],
      } satisfies CanonSectionGlossaryWork);

    group.terms.push({
      ...rowToGlossaryTermNode({ ...row, withAttestations }),
      headword: row.headword,
      headwordLanguage: row.headword_language,
    });

    if (!existing) {
      byWork.set(row.work_uuid, group);
    }
  }

  return [...byWork.values()].sort(
    (a, b) => tohSortKey(a.work) - tohSortKey(b.work),
  );
};
