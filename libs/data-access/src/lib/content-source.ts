/**
 * Which copy of a work's content a read resolves against.
 *
 * - `draft` — the mutable editor tables. The studio and the editor read these,
 *   and they are the only thing that is written.
 * - `published` — the live snapshot of the currently published version.
 *
 * Published reads go through the `*_live` views rather than the `published_*`
 * tables directly. Those tables are keyed on `(version_uuid, <domain uuid>)`, so
 * a domain UUID is not unique in them: the publish pipeline writes a new
 * version's rows before flipping `works.published_version_uuid`, and retires the
 * previous version's rows only afterwards (non-fatally, so leftovers can outlive
 * a failed retire). Each view joins `works` on that pointer, so a read cannot see
 * a version that is staged but not live. Keeping the predicate there rather than
 * at each call site also lets the cross-work reads express it at all — PostgREST
 * cannot compare two columns.
 *
 * Every default funnels through DEFAULT_CONTENT_SOURCE, which is `published`, so
 * adding this changes no caller's behaviour. A surface reads the published
 * snapshot only by declaring so.
 */
export const CONTENT_SOURCES = ['draft', 'published'] as const;

export type ContentSource = (typeof CONTENT_SOURCES)[number];

/**
 * What a caller gets when it does not choose. Every default in this module funnels
 * through here, so switching a surface to a different snapshot is a deliberate
 * act at that surface rather than a side effect of this constant.
 */
export const DEFAULT_CONTENT_SOURCE: ContentSource = 'published';

/**
 * The header carrying the source across an API boundary.
 *
 * A request, not a query, chooses the source: an app reads one copy throughout —
 * the studio and editor draft, the reading room and the public MCP API published
 * once each is switched — so the choice belongs to the caller rather than to each
 * call site. Threading it through every query variable, data function and
 * component prop bought nothing that this does not.
 */
export const CONTENT_SOURCE_HEADER = 'x-84000-content-source';

/**
 * How an app declares which copy it serves. Set in `next.config.js` rather than
 * an env file so it is version-controlled and visible in review.
 *
 */
export const CONTENT_SOURCE_ENV_VAR = 'NEXT_PUBLIC_CONTENT_SOURCE';

/**
 * Reads the ambient source for the app this code is running in. Works in both
 * server and browser contexts because the variable is `NEXT_PUBLIC_`, and it is
 * read at call time rather than module load so tests can vary it.
 */
export const contentSourceFromEnv = (): ContentSource => {
  const declared = process.env[CONTENT_SOURCE_ENV_VAR];
  return isContentSource(declared) ? declared : DEFAULT_CONTENT_SOURCE;
};

/**
 * Narrows a header value. Absent or unrecognised resolves to
 * DEFAULT_CONTENT_SOURCE, so a caller that does not ask gets what it would have
 * got before this header existed.
 */
export const contentSourceFromHeader = (
  value: string | null | undefined,
): ContentSource => (isContentSource(value) ? value : DEFAULT_CONTENT_SOURCE);

/** Narrows arbitrary input (a GraphQL argument, a query param) to a ContentSource. */
export const isContentSource = (value: unknown): value is ContentSource =>
  typeof value === 'string' &&
  (CONTENT_SOURCES as readonly string[]).includes(value);

/**
 * Relation names per source. The published entries are the `_live` views, never
 * the underlying `published_*` tables — see the note above.
 */
const RELATIONS = {
  draft: {
    passages: 'passages',
    passageAnnotations: 'passage_annotations',
    glossaryTerms: 'glossary_term_index',
    bibliographies: 'bibliographies',
  },
  published: {
    passages: 'published_passages_live',
    passageAnnotations: 'published_passage_annotations_live',
    glossaryTerms: 'published_glossaries_live',
    bibliographies: 'published_bibliographies_live',
  },
} as const satisfies Record<ContentSource, Record<string, string>>;

export type ContentRelation = keyof (typeof RELATIONS)['draft'];

/** The table or view holding `relation` for `source`. */
export const relationFor = (
  relation: ContentRelation,
  source: ContentSource = DEFAULT_CONTENT_SOURCE,
): string => RELATIONS[source][relation];

/**
 * RPC names per source. Only the functions still on the reader path have a
 * published variant; anything reading unversioned data (titles, imprints, folios,
 * alignments) is shared and absent here.
 */
const RPCS = {
  draft: {
    workToc: 'get_work_toc',
    showBibliographies: 'show_bibliographies',
    bibliographyLabels: 'bibliography_labels',
    translationSearch: 'translation_search',
    passageReferences: 'get_passage_annotations_by_content_uuids',
    workGlossarySearch: 'search_work_glossary_terms',
  },
  published: {
    workToc: 'get_work_toc_published',
    showBibliographies: 'show_bibliographies_published',
    bibliographyLabels: 'bibliography_labels_published',
    translationSearch: 'translation_search_published',
    passageReferences: 'get_passage_annotations_by_content_uuids_published',
    workGlossarySearch: 'search_work_glossary_terms_published',
  },
} as const satisfies Record<ContentSource, Record<string, string>>;

export type ContentRpc = keyof (typeof RPCS)['draft'];

/** The Postgres function implementing `rpc` for `source`. */
export const rpcFor = (
  rpc: ContentRpc,
  source: ContentSource = DEFAULT_CONTENT_SOURCE,
): string => RPCS[source][rpc];

/**
 * Passage columns to select, per source.
 *
 * The published snapshot is UUID-only by design — `published_passages` have
 * no `xmlId` column — so selecting it there would error. Published passages
 * therefore surface `xmlId` as null. Nothing in the reader render path reads it;
 * hash deep links resolve through `lookup()`, which keys xmlIds against the draft
 * tables and returns a UUID that is stable across both copies.
 */
export const passageColumnsFor = (
  source: ContentSource = DEFAULT_CONTENT_SOURCE,
): string =>
  source === 'published'
    ? 'uuid, content, label, sort, type, toh, work_uuid'
    : 'uuid, content, label, sort, type, toh, xmlId, work_uuid';
