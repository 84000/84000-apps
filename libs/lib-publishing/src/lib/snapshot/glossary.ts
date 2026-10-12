/**
 * A work's draft glossary, assembled from the base tables.
 *
 * The draft glossary relation, `glossary_term_index`, is a materialized view that only
 * publish refreshes, so it can lag the draft. This rebuilds the same rows from
 * `glossaries`, `glossary_edges`, `names` and `authorities`, following the view's
 * definition: a term is a glossary row with a self-edge, and its other names are the
 * children of that edge.
 */

import type { DataClient } from '@eightyfourthousand/data-access';
import type { PublishedGlossaryTerm } from '../types';
import { readByIn, readKeyset } from './paging';

export interface GlossaryRow {
  uuid: string;
  work_uuid: string;
  authority_uuid: string;
  name_uuid: string;
  definition: string | null;
  definition_rend: string | null;
  termType: string | null;
  attestation: string | null;
}

export interface GlossaryEdgeRow {
  parent_uuid: string;
  child_uuid: string;
}

export interface NameRow {
  uuid: string;
  content: string;
  content_transformed: string | null;
  language: string | null;
}

export interface AuthorityRow {
  uuid: string;
  headword: string | null;
  headword_language: string | null;
  definition: string | null;
}

const GLOSSARY_COLUMNS =
  'uuid, work_uuid, authority_uuid, name_uuid, definition, definition_rend, termType, attestation';

const collator = new Intl.Collator('en-US', { ignorePunctuation: true });

const distinctSorted = (
  values: (string | null | undefined)[],
): string | null => {
  const unique = [...new Set(values.filter((v): v is string => v != null))];
  return unique.length ? unique.sort(collator.compare).join(', ') : null;
};

const stripHtml = (html: string): string =>
  html
    .replace(/<[^>]*>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/\s+/g, ' ')
    .trim();

/** `lower(unaccent(…))`, as the view sorts terms. */
const sortKey = (value: string): string =>
  value.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase();

const blank = (value: string | null | undefined): string | null =>
  value && value.trim() ? value.trim() : null;

/** Port of the database's `format_attestation(text, true)`. */
export const formatAttestation = (text: string | null): string | null => {
  if (text == null || !text.trim()) return null;
  const v = text
    .trim()
    .replace(/\s+/g, ' ')
    .replace(/([\p{Ll}\p{Nd}])(\p{Lu})/gu, '$1 $2')
    .replace(/(\p{Lu}+)(\p{Lu}\p{Ll})/gu, '$1 $2')
    .replace(/\s+([,;:.)\]}])/g, '$1')
    .replace(/([,;:])([^\s)\]}])/g, '$1 $2')
    .replace(/\s*[-–—]+\s*/g, ' – ')
    .replace(/\(\s+/g, '(')
    .replace(/\s+\)/g, ')')
    .replace(/\[\s+/g, '[')
    .replace(/\s+\]/g, ']')
    .replace(/\{\s+/g, '{')
    .replace(/\s+\}/g, '}')
    .replace(/\s+/g, ' ')
    .trim();
  // initcap: first letter of each alphanumeric run upper, the rest lower.
  return v
    .toLowerCase()
    .replace(
      /(^|[^\p{L}\p{N}])(\p{L})/gu,
      (_, before, letter) => before + letter.toUpperCase(),
    );
};

const attestedSanskrit = (name: string, attestation: string | null): string => {
  if (attestation === 'reconstructedSemantic') {
    return `*${name} (${formatAttestation(attestation)})`;
  }
  return attestation ? `${name} (${formatAttestation(attestation)})` : name;
};

const STANDARD_RENDS = new Set([
  'appendWithStandard',
  'prependWithStandard',
  'bothWithStandard',
]);

/** The definition the view shows, combining the work's and the authority's. */
export const termDefinition = (
  glossaryDefinition: string | null,
  standardDefinition: string | null,
  rend: string | null,
): string => {
  if (rend === 'overrideWithStandard') return standardDefinition ?? '';
  if (rend && STANDARD_RENDS.has(rend)) {
    const standard = (standardDefinition ?? '').trim();
    if (
      standard &&
      stripHtml((glossaryDefinition ?? '').trim()).includes(stripHtml(standard))
    ) {
      return glossaryDefinition ?? '';
    }
    // SQL concatenation with a null operand is null, which the view coalesces to ''.
    if (glossaryDefinition == null || standardDefinition == null) return '';
    return rend === 'appendWithStandard'
      ? `${glossaryDefinition} ${standardDefinition}`
      : `${standardDefinition} ${glossaryDefinition}`;
  }
  return glossaryDefinition ?? '';
};

/** Builds the work's term rows, numbered in the view's order. Pure. */
export const assembleGlossaryTerms = ({
  workUuid,
  glossaries,
  edges,
  names,
  authorities,
}: {
  workUuid: string;
  glossaries: GlossaryRow[];
  edges: GlossaryEdgeRow[];
  names: NameRow[];
  authorities: AuthorityRow[];
}): PublishedGlossaryTerm[] => {
  const glossaryByUuid = new Map(glossaries.map((g) => [g.uuid, g]));
  const nameByUuid = new Map(names.map((n) => [n.uuid, n]));
  const authorityByUuid = new Map(authorities.map((a) => [a.uuid, a]));
  const terms = new Set<string>();
  const children = new Map<string, GlossaryRow[]>();
  for (const edge of edges) {
    if (edge.parent_uuid === edge.child_uuid) terms.add(edge.parent_uuid);
    const child = glossaryByUuid.get(edge.child_uuid);
    if (!child) continue;
    const list = children.get(edge.parent_uuid) ?? [];
    list.push(child);
    children.set(edge.parent_uuid, list);
  }

  const rows = glossaries
    .filter((g) => g.work_uuid === workUuid && terms.has(g.uuid))
    .flatMap((g) => {
      const authority = authorityByUuid.get(g.authority_uuid);
      const own = nameByUuid.get(g.name_uuid);
      if (!authority || !own) return [];

      const kids = children.get(g.uuid) ?? [];
      const named = (filter: (child: GlossaryRow) => boolean) =>
        kids
          .filter(filter)
          .map((child) => ({ child, name: nameByUuid.get(child.name_uuid) }))
          .filter((x): x is { child: GlossaryRow; name: NameRow } => !!x.name);
      const variants = named((c) => c.termType !== 'translationAlternative');
      const inLanguage = (...languages: string[]) =>
        variants.filter((v) => languages.includes(v.name.language ?? ''));
      const sanskrit = inLanguage('Sa-Ltn');

      const english = own.content;
      const headword = authority.headword;
      return [
        {
          glossary_uuid: g.uuid,
          authority_uuid: g.authority_uuid,
          work_uuid: g.work_uuid,
          headword,
          headword_language: authority.headword_language,
          english,
          wylie: distinctSorted(
            inLanguage('Bo-Ltn').map((v) => v.name.content),
          ),
          tibetan: distinctSorted(
            inLanguage('Bo-Ltn').map((v) => v.name.content_transformed),
          ),
          sanskrit_plain: distinctSorted(sanskrit.map((v) => v.name.content)),
          sanskrit_attested: distinctSorted(
            sanskrit.map((v) =>
              attestedSanskrit(v.name.content, v.child.attestation),
            ),
          ),
          chinese: distinctSorted(
            inLanguage('zh', 'Zh-Hant').map((v) => v.name.content),
          ),
          pali: distinctSorted(inLanguage('Pi-Ltn').map((v) => v.name.content)),
          alternatives: distinctSorted(
            named((c) => c.termType === 'translationAlternative').map(
              (v) => v.name.content,
            ),
          ),
          definition: termDefinition(
            g.definition,
            authority.definition,
            g.definition_rend,
          ),
          english_sort: sortKey(
            blank(english) ?? blank(headword) ?? g.authority_uuid,
          ),
          headword_sort: sortKey(
            blank(headword) ?? blank(english) ?? g.authority_uuid,
          ),
          term_number: 0,
          search_text: null,
        } satisfies PublishedGlossaryTerm,
      ];
    });

  const order = (a: PublishedGlossaryTerm, b: PublishedGlossaryTerm) =>
    collator.compare(a.english_sort ?? '', b.english_sort ?? '') ||
    collator.compare(a.headword_sort ?? '', b.headword_sort ?? '') ||
    a.authority_uuid.localeCompare(b.authority_uuid);

  return rows.sort(order).map((term, i) => ({
    ...term,
    term_number: i + 1,
    search_text: [
      term.english,
      term.headword,
      term.alternatives,
      term.wylie,
      term.tibetan,
      term.sanskrit_plain,
      term.sanskrit_attested,
      term.chinese,
      term.pali,
      term.definition,
    ]
      .filter((v) => v != null)
      .join(' '),
  }));
};

/**
 * Maps each glossary uuid an instance may cite (a term, or one of its child names) to
 * its term, as instance lookups resolve children through their edge. Pure.
 */
export const glossaryTermOf = (
  terms: PublishedGlossaryTerm[],
  edges: GlossaryEdgeRow[],
): Map<string, string> => {
  const termUuids = new Set(terms.map((t) => t.glossary_uuid));
  const out = new Map([...termUuids].map((uuid) => [uuid, uuid]));
  const sorted = [...edges].sort(
    (a, b) =>
      a.child_uuid.localeCompare(b.child_uuid) ||
      a.parent_uuid.localeCompare(b.parent_uuid),
  );
  for (const edge of sorted) {
    if (termUuids.has(edge.parent_uuid) && !out.has(edge.child_uuid)) {
      out.set(edge.child_uuid, edge.parent_uuid);
    }
  }
  return out;
};

export interface DraftGlossary {
  terms: PublishedGlossaryTerm[];
  /** Glossary uuid (term or child) to term uuid. */
  termOf: Map<string, string>;
}

/** Reads and assembles a work's draft glossary terms. */
export const readDraftGlossary = async ({
  client,
  workUuid,
}: {
  client: DataClient;
  workUuid: string;
}): Promise<DraftGlossary> => {
  const glossaries = await readKeyset<GlossaryRow & Record<string, unknown>>({
    build: () =>
      client
        .from('glossaries')
        .select(GLOSSARY_COLUMNS)
        .eq('work_uuid', workUuid),
    idColumn: 'uuid',
    what: 'glossaries',
  });
  const edges = await readByIn<GlossaryEdgeRow & Record<string, unknown>>({
    client,
    table: 'glossary_edges',
    columns: 'parent_uuid, child_uuid',
    column: 'parent_uuid',
    values: glossaries.map((g) => g.uuid),
    sortColumn: 'parent_uuid',
    idColumn: 'child_uuid',
    what: 'glossary edges',
  });

  // A term's children normally belong to the same work; fetch any that do not.
  const known = new Set(glossaries.map((g) => g.uuid));
  const foreign = [...new Set(edges.map((e) => e.child_uuid))].filter(
    (uuid) => !known.has(uuid),
  );
  const outside = await readByIn<GlossaryRow & Record<string, unknown>>({
    client,
    table: 'glossaries',
    columns: GLOSSARY_COLUMNS,
    column: 'uuid',
    values: foreign,
    idColumn: 'uuid',
    what: 'glossaries',
  });
  const all = [...glossaries, ...outside];

  const [names, authorities] = await Promise.all([
    readByIn<NameRow & Record<string, unknown>>({
      client,
      table: 'names',
      columns: 'uuid, content, content_transformed, language',
      column: 'uuid',
      values: [...new Set(all.map((g) => g.name_uuid))],
      idColumn: 'uuid',
      what: 'glossary names',
    }),
    readByIn<AuthorityRow & Record<string, unknown>>({
      client,
      table: 'authorities',
      columns: 'uuid, headword, headword_language, definition',
      column: 'uuid',
      values: [...new Set(all.map((g) => g.authority_uuid))],
      idColumn: 'uuid',
      what: 'glossary authorities',
    }),
  ]);

  const terms = assembleGlossaryTerms({
    workUuid,
    glossaries: all,
    edges,
    names,
    authorities,
  });
  return { terms, termOf: glossaryTermOf(terms, edges) };
};
