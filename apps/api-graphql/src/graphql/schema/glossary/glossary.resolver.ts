import type { GraphQLContext } from '../../context';
import type { WorkParent } from '../work/work.types';
import {
  getAllGlossaryTerms,
  getGlossaryEntry,
  getGlossaryInstance,
  getGlossaryInstances,
  passageFromDTO,
  type DataClient,
  type PassageDTO,
} from '@data-access';
import type { SortedGlossaryRow } from './glossary-sorted-rows.loader';

type PaginationDirection = 'FORWARD' | 'BACKWARD' | 'AROUND';

type NameRow = {
  uuid: string;
  authority_uuid: string;
  language: string;
  content: string;
  content_transformed: string | null;
};

type GlossaryTermNode = {
  uuid: string;
  authority: string;
  definition: string | null;
  termNumber: number;
  names: {
    english: string | null;
    tibetan: string | null;
    sanskrit: string | null;
    pali: string | null;
    chinese: string | null;
    wylie: string | null;
  };
};


/**
 * Format attestation label - replicate Postgres format_attestation() in JS
 * Splits camelCase, normalizes spacing/punctuation, title-cases
 */
function formatAttestation(text: string | null, titlecase: boolean): string | null {
  if (!text || text.trim() === '') return null;

  let v = text.trim();
  // Collapse internal whitespace
  v = v.replace(/\s+/g, ' ');
  // Split camelCase: lower/digit followed by Upper
  v = v.replace(/([a-z\d])([A-Z])/g, '$1 $2');
  // Split acronym boundaries: consecutive uppers followed by Upper-lower
  v = v.replace(/([A-Z]+)([A-Z][a-z])/g, '$1 $2');
  // Normalize punctuation spacing
  v = v.replace(/\s+([,;:.\)\]\}])/g, '$1');
  v = v.replace(/([,;:])([^\s\)\]\}])/g, '$1 $2');
  // Normalize dashes
  v = v.replace(/\s*[-–—]+\s*/g, ' – ');
  // Normalize bracket inner spaces
  v = v.replace(/\(\s+/g, '(');
  v = v.replace(/\s+\)/g, ')');
  // Cleanup doubles
  v = v.replace(/\s+/g, ' ').trim();

  if (titlecase) {
    // Title-case each word
    v = v.replace(/\b\w/g, (c) => c.toUpperCase());
  } else {
    v = v.toLowerCase();
  }

  return v;
}

/**
 * Strip HTML tags from a string (replicate Postgres strip_html)
 */
function stripHtml(str: string): string {
  return str.replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim();
}

/**
 * Merge glossary definition with authority (standard) definition
 * based on definition_rend value
 */
function mergeDefinition(
  glossaryDef: string | null,
  standardDef: string | null,
  definitionRend: string | null,
): string {
  switch (definitionRend) {
    case 'overrideWithStandard':
      return standardDef ?? '';

    case 'incompatibleWithStandard':
      return glossaryDef ?? '';

    case 'appendWithStandard': {
      const trimmedStandard = (standardDef ?? '').trim();
      if (
        trimmedStandard &&
        stripHtml((glossaryDef ?? '').trim()).includes(stripHtml(trimmedStandard))
      ) {
        return glossaryDef ?? '';
      }
      return ((glossaryDef ?? '') + ' ' + (standardDef ?? '')).trim();
    }

    case 'prependWithStandard': {
      const trimmedStandard = (standardDef ?? '').trim();
      if (
        trimmedStandard &&
        stripHtml((glossaryDef ?? '').trim()).includes(stripHtml(trimmedStandard))
      ) {
        return glossaryDef ?? '';
      }
      return ((standardDef ?? '') + ' ' + (glossaryDef ?? '')).trim();
    }

    case 'bothWithStandard': {
      const trimmedStandard = (standardDef ?? '').trim();
      if (
        trimmedStandard &&
        stripHtml((glossaryDef ?? '').trim()).includes(stripHtml(trimmedStandard))
      ) {
        return glossaryDef ?? '';
      }
      return ((standardDef ?? '') + ' ' + (glossaryDef ?? '')).trim();
    }

    default:
      return glossaryDef ?? '';
  }
}

/**
 * Build GlossaryTermNode objects from sorted glossary rows by aggregating names
 * and merging definitions.
 */
async function hydrateGlossaryTerms(
  supabase: DataClient,
  sortedRows: SortedGlossaryRow[],
  withAttestations: boolean,
): Promise<GlossaryTermNode[]> {
  if (sortedRows.length === 0) return [];

  // Get unique authority UUIDs and work UUIDs
  const authorityUuids = [...new Set(sortedRows.map((g) => g.authority_uuid))];
  const workUuids = [...new Set(sortedRows.map((g) => g.work_uuid))];

  // Fetch all names for these authorities
  const { data: nameRows } = await supabase
    .from('names')
    .select('uuid, authority_uuid, language, content, content_transformed')
    .in('authority_uuid', authorityUuids);

  // Fetch authority definitions for definition merging
  const { data: authorityRows } = await supabase
    .from('authorities')
    .select('uuid, definition')
    .in('uuid', authorityUuids);

  // Fetch all glossary rows for these authorities in these works
  // (needed to aggregate names across multiple glossary entries for same authority)
  const { data: allGlossaryRows } = await supabase
    .from('glossaries')
    .select('uuid, work_uuid, authority_uuid, name_uuid, attestation')
    .in('authority_uuid', authorityUuids)
    .in('work_uuid', workUuids);

  const names = (nameRows ?? []) as NameRow[];
  const authorities = new Map(
    ((authorityRows ?? []) as { uuid: string; definition: string | null }[]).map(
      (a) => [a.uuid, a.definition],
    ),
  );
  const allGlossaries = (allGlossaryRows ?? []) as {
    uuid: string;
    work_uuid: string;
    authority_uuid: string;
    name_uuid: string;
    attestation: string | null;
  }[];

  // Build a lookup: name_uuid -> attestation for this work
  const nameAttestationMap = new Map<string, string | null>();
  for (const g of allGlossaries) {
    nameAttestationMap.set(g.name_uuid, g.attestation);
  }

  // Group names by authority_uuid
  const namesByAuthority = new Map<string, NameRow[]>();
  for (const name of names) {
    const existing = namesByAuthority.get(name.authority_uuid) ?? [];
    existing.push(name);
    namesByAuthority.set(name.authority_uuid, existing);
  }

  // For each glossary row, aggregate names for its authority within its work
  // We need to know which name_uuids belong to glossary entries for this authority+work
  const nameUuidsByAuthorityWork = new Map<string, Set<string>>();
  for (const g of allGlossaries) {
    const key = `${g.authority_uuid}:${g.work_uuid}`;
    const existing = nameUuidsByAuthorityWork.get(key) ?? new Set();
    existing.add(g.name_uuid);
    nameUuidsByAuthorityWork.set(key, existing);
  }

  const result: GlossaryTermNode[] = [];

  for (const row of sortedRows) {
    const authorityKey = `${row.authority_uuid}:${row.work_uuid}`;

    // Get name_uuids for this authority in this work
    const relevantNameUuids = nameUuidsByAuthorityWork.get(authorityKey) ?? new Set();

    // Get all names for this authority that are referenced by glossary entries in this work
    const authorityNames = (namesByAuthority.get(row.authority_uuid) ?? []).filter(
      (n) => relevantNameUuids.has(n.uuid),
    );

    // Aggregate names by language
    const englishNames: string[] = [];
    const wylieNames: string[] = [];
    const tibetanNames: string[] = [];
    const sanskritNames: string[] = [];
    const chineseNames: string[] = [];
    const paliNames: string[] = [];

    for (const name of authorityNames) {
      const attestation = nameAttestationMap.get(name.uuid);

      switch (name.language) {
        case 'en':
          englishNames.push(name.content);
          break;
        case 'Bo-Ltn':
          wylieNames.push(name.content);
          if (name.content_transformed) {
            tibetanNames.push(name.content_transformed);
          }
          break;
        case 'Sa-Ltn': {
          if (!withAttestations) {
            sanskritNames.push(name.content);
          } else if (attestation === 'reconstructedSemantic') {
            const label = formatAttestation(attestation, true);
            sanskritNames.push(`*${name.content} (${label})`);
          } else if (attestation) {
            const label = formatAttestation(attestation, true);
            sanskritNames.push(`${name.content} (${label})`);
          } else {
            sanskritNames.push(name.content);
          }
          break;
        }
        case 'zh':
          chineseNames.push(name.content);
          break;
        case 'Pi-Ltn':
          paliNames.push(name.content);
          break;
      }
    }

    // Sort and join
    const sortJoin = (arr: string[]) =>
      arr.length > 0 ? arr.sort().join(', ') : null;

    // Merge definition
    const standardDef = authorities.get(row.authority_uuid) ?? null;
    const definition = mergeDefinition(row.definition, standardDef, row.definition_rend);

    result.push({
      uuid: row.uuid,
      authority: row.authority_uuid,
      definition: definition || null,
      termNumber: row.termNumber,
      names: {
        english: sortJoin(englishNames),
        wylie: sortJoin(wylieNames),
        tibetan: sortJoin(tibetanNames),
        sanskrit: sortJoin(sanskritNames),
        chinese: sortJoin(chineseNames),
        pali: sortJoin(paliNames),
      },
    });
  }

  return result;
}

/**
 * Helper to build a GlossaryTermConnection response
 */
function buildGlossaryTermConnection(
  nodes: GlossaryTermNode[],
  nextCursor: string | null,
  prevCursor: string | null,
  hasMoreAfter: boolean,
  hasMoreBefore: boolean,
  totalCount: number,
) {
  return {
    nodes,
    pageInfo: {
      nextCursor,
      prevCursor,
      hasMoreAfter,
      hasMoreBefore,
    },
    totalCount,
  };
}

const DEFAULT_GLOSSARY_LIMIT = 50;
const MAX_GLOSSARY_LIMIT = 200;
const DEFAULT_GLOSSARY_PASSAGES_LIMIT = 10;

function parseOffsetCursor(after?: string) {
  if (!after) return 0;

  const parsed = Number.parseInt(after, 10);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : 0;
}

async function getPaginatedGlossaryTermPassages(
  supabase: DataClient,
  uuid: string,
  first?: number,
  after?: string,
) {
  const limit = Math.max(first ?? DEFAULT_GLOSSARY_PASSAGES_LIMIT, 1);
  const offset = parseOffsetCursor(after);

  // Step 1: Find matching passages using the indexed JSONB filter.
  const { data: annotations, error: annotationsError } = await supabase
    .from('passage_annotations')
    .select('passage_uuid')
    .eq('type', 'glossary-instance')
    .filter('content', 'cs', JSON.stringify([{ uuid }]));

  if (annotationsError) {
    console.error('Error fetching glossary passage annotations:', annotationsError);
    return { items: [], nextCursor: null, hasMore: false };
  }

  const passageUuids = (annotations ?? []).map(
    (annotation: { passage_uuid: string }) => annotation.passage_uuid,
  );

  if (passageUuids.length === 0) {
    return { items: [], nextCursor: null, hasMore: false };
  }

  // Step 2: Fetch the requested window plus one row to compute hasMore.
  const { data: passages, error: passagesError } = await supabase
    .from('passages')
    .select('uuid, content, label, sort, type, xmlId, work_uuid, toh')
    .in('uuid', passageUuids)
    .order('sort', { ascending: true })
    .range(offset, offset + limit);

  if (passagesError) {
    console.error('Error fetching glossary passages:', passagesError);
    return { items: [], nextCursor: null, hasMore: false };
  }

  const rows = passages ?? [];
  const hasMore = rows.length > limit;
  const items = hasMore ? rows.slice(0, limit) : rows;

  return {
    items: items.map((passage: PassageDTO) => passageFromDTO(passage)),
    nextCursor: hasMore ? String(offset + limit) : null,
    hasMore,
  };
}

/**
 * Field resolver for GlossaryTermInstance.passages
 * Fetches only the requested window of passages for this glossary term.
 */
export const glossaryTermPassagesResolver = async (
  parent: { uuid: string },
  args: { first?: number; after?: string },
  ctx: GraphQLContext,
) => {
  return getPaginatedGlossaryTermPassages(
    ctx.supabase,
    parent.uuid,
    args.first,
    args.after,
  );
};

/**
 * Resolver for Query.glossaryTerms - fetches all glossary terms for landing page
 */
export const glossaryTermsResolver = async (
  _parent: unknown,
  args: { uuids?: string[] },
  ctx: GraphQLContext,
) => {
  const terms = await getAllGlossaryTerms({
    client: ctx.supabase,
    uuids: args.uuids,
  });

  return terms;
};

/**
 * Resolver for Query.glossaryEntry - fetches a single glossary entry for detail page
 */
export const glossaryEntryResolver = async (
  _parent: unknown,
  args: { uuid: string },
  ctx: GraphQLContext,
) => {
  const entry = await getGlossaryEntry({
    client: ctx.supabase,
    uuid: args.uuid,
  });

  if (!entry) {
    return null;
  }

  return entry;
};

/**
 * Resolver for Query.glossaryInstance - fetches a single glossary instance
 */
export const glossaryInstanceResolver = async (
  _parent: unknown,
  args: { uuid: string },
  ctx: GraphQLContext,
) => {
  const instance = await getGlossaryInstance({
    client: ctx.supabase,
    uuid: args.uuid,
  });

  return instance ?? null;
};

/**
 * Resolver for Query.glossaryTermPassages - paginated passage refs for a single term
 * Uses two-step approach: JSONB @> filter on passage_annotations (GIN index),
 * then paginated passages query ordered by sort.
 */
export const glossaryTermPassagesPageResolver = async (
  _parent: unknown,
  args: { uuid: string; first?: number; after?: string },
  ctx: GraphQLContext,
) => {
  return getPaginatedGlossaryTermPassages(
    ctx.supabase,
    args.uuid,
    args.first,
    args.after,
  );
};

/**
 * Resolver for Work.glossary - fetches glossary term instances for a work
 * @deprecated Use workGlossaryTermsResolver for paginated access
 */
export const workGlossaryResolver = async (
  parent: WorkParent,
  args: { withAttestations?: boolean },
  ctx: GraphQLContext,
) => {
  const instances = await getGlossaryInstances({
    client: ctx.supabase,
    uuid: parent.uuid,
    withAttestations: args.withAttestations ?? false,
  });

  return instances;
};

/**
 * Paginate a sorted glossary list by cursor and direction.
 * Cursor is a glossary UUID found by position in the sorted list.
 */
function paginateSortedRows(
  sorted: SortedGlossaryRow[],
  limit: number,
  cursor: string | null,
  direction: 'FORWARD' | 'BACKWARD',
): { rows: SortedGlossaryRow[]; hasMore: boolean } {
  const isForward = direction === 'FORWARD';

  if (!cursor) {
    if (isForward) {
      const hasMore = sorted.length > limit;
      return { rows: sorted.slice(0, limit), hasMore };
    } else {
      const hasMore = sorted.length > limit;
      const start = hasMore ? sorted.length - limit : 0;
      return { rows: sorted.slice(start), hasMore };
    }
  }

  // Find cursor position in the sorted list
  const cursorIndex = sorted.findIndex((r) => r.uuid === cursor);
  if (cursorIndex === -1) {
    // Cursor not found — fall back to start
    const hasMore = sorted.length > limit;
    return { rows: sorted.slice(0, limit), hasMore };
  }

  if (isForward) {
    // Items after the cursor
    const afterCursor = sorted.slice(cursorIndex + 1);
    const hasMore = afterCursor.length > limit;
    return { rows: afterCursor.slice(0, limit), hasMore };
  } else {
    // Items before the cursor
    const beforeCursor = sorted.slice(0, cursorIndex);
    const hasMore = beforeCursor.length > limit;
    const start = hasMore ? beforeCursor.length - limit : 0;
    return { rows: beforeCursor.slice(start), hasMore };
  }
}

/**
 * Resolver for Work.glossaryTerms — paginated glossary terms for a work
 */
export const workGlossaryTermsResolver = async (
  parent: WorkParent,
  args: {
    cursor?: string;
    limit?: number;
    direction?: PaginationDirection;
    withAttestations?: boolean;
  },
  ctx: GraphQLContext,
) => {
  const limit = Math.min(
    Math.max(args.limit ?? DEFAULT_GLOSSARY_LIMIT, 1),
    MAX_GLOSSARY_LIMIT,
  );
  const direction = args.direction ?? 'FORWARD';
  const withAttestations = args.withAttestations ?? false;

  const sorted = await ctx.loaders.sortedGlossaryRowsByWorkUuid.load(parent.uuid);
  const totalCount = sorted.length;

  if (totalCount === 0) {
    return buildGlossaryTermConnection([], null, null, false, false, 0);
  }

  if (direction === 'AROUND') {
    return glossaryTermsAroundResolver(
      sorted,
      args,
      ctx,
      limit,
      withAttestations,
      totalCount,
    );
  }

  const isForward = direction === 'FORWARD';
  const cursorUuid = args.cursor ?? null;

  const { rows, hasMore } = paginateSortedRows(sorted, limit, cursorUuid, direction);

  if (rows.length === 0) {
    return buildGlossaryTermConnection(
      [],
      null,
      null,
      false,
      cursorUuid !== null,
      totalCount,
    );
  }

  const nodes = await hydrateGlossaryTerms(ctx.supabase, rows, withAttestations);

  const hasMoreAfter = isForward ? hasMore : cursorUuid !== null;
  const hasMoreBefore = isForward ? cursorUuid !== null : hasMore;

  const firstRow = rows[0];
  const lastRow = rows[rows.length - 1];
  const nextCursor = hasMoreAfter ? lastRow.uuid : null;
  const prevCursor = hasMoreBefore ? firstRow.uuid : null;

  return buildGlossaryTermConnection(
    nodes,
    nextCursor,
    prevCursor,
    hasMoreAfter,
    hasMoreBefore,
    totalCount,
  );
};

/**
 * Handle AROUND direction for glossary terms — fetch terms centered around cursor
 */
const glossaryTermsAroundResolver = async (
  sorted: SortedGlossaryRow[],
  args: {
    cursor?: string;
    withAttestations?: boolean;
  },
  ctx: GraphQLContext,
  limit: number,
  withAttestations: boolean,
  totalCount: number,
) => {
  if (!args.cursor) {
    // No cursor: fall back to forward from start
    const sliced = sorted.slice(0, limit);
    const hasMore = sorted.length > limit;
    const nodes = await hydrateGlossaryTerms(ctx.supabase, sliced, withAttestations);
    const lastRow = sliced[sliced.length - 1];

    return buildGlossaryTermConnection(
      nodes,
      hasMore && lastRow ? lastRow.uuid : null,
      null,
      hasMore,
      false,
      totalCount,
    );
  }

  const limitBefore = Math.floor(limit / 2);
  const limitAfter = limit - limitBefore;

  const cursorIndex = sorted.findIndex((r) => r.uuid === args.cursor);
  if (cursorIndex === -1) {
    // Cursor not found — fall back to forward from start
    const sliced = sorted.slice(0, limit);
    const hasMore = sorted.length > limit;
    const nodes = await hydrateGlossaryTerms(ctx.supabase, sliced, withAttestations);
    const lastRow = sliced[sliced.length - 1];

    return buildGlossaryTermConnection(
      nodes,
      hasMore && lastRow ? lastRow.uuid : null,
      null,
      hasMore,
      false,
      totalCount,
    );
  }

  const startIndex = Math.max(0, cursorIndex - limitBefore);
  const endIndex = Math.min(sorted.length, cursorIndex + limitAfter);
  const sliced = sorted.slice(startIndex, endIndex);

  const hasMoreBefore = startIndex > 0;
  const hasMoreAfter = endIndex < sorted.length;

  const nodes = await hydrateGlossaryTerms(ctx.supabase, sliced, withAttestations);

  const firstRow = sliced[0];
  const lastRow = sliced[sliced.length - 1];

  return buildGlossaryTermConnection(
    nodes,
    hasMoreAfter && lastRow ? lastRow.uuid : null,
    hasMoreBefore && firstRow ? firstRow.uuid : null,
    hasMoreAfter,
    hasMoreBefore,
    totalCount,
  );
};
