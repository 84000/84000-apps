import type { DataClient } from '../types';
import { relationFor } from '../content-source';
import { inBatches } from '../passage/in-batches';

/** A draft passage, as the resolver reads it. */
export interface ResolvePassage {
  uuid: string;
  content: string;
  label: string | null;
  sort: number | null;
  type: string;
}

/** A draft annotation of a type the resolver needs to see. */
export interface ResolveAnnotation {
  uuid: string;
  passageUuid: string;
  type: string;
  start: number;
  end: number;
  content: Record<string, unknown>[];
}

/** A glossary term of the work, with every English form it may appear as. */
export interface ResolveTerm {
  uuid: string;
  authorityUuid: string;
  english: string | null;
  alternatives: string[];
}

export interface ResolveInput {
  passages: ResolvePassage[];
  annotations: ResolveAnnotation[];
  terms: ResolveTerm[];
  /** Glossary uuid an instance may cite (a term or one of its child names) to its term. */
  termOf: Map<string, string>;
}

/** Annotation types that decide whether a match is new, taken, or inside excluded text. */
export const RESOLVE_ANNOTATION_TYPES = [
  'glossary-instance',
  'inline-title',
  'span',
  'mantra',
] as const;

const PAGE = 1000;

// PostgREST's builder types do not survive being passed around generically.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Query = any;

type Result<T> = { data: T } | { error: string };

/**
 * Every row `build()` returns, keyset-paged on `keys` (one column, or two whose
 * pair is unique), so a write landing mid-read cannot make a page skip rows.
 */
const readAll = async <T extends object>(
  build: () => Query,
  keys: [string] | [string, string] = ['uuid'],
): Promise<Result<T[]>> => {
  const rows: T[] = [];
  let last: T | null = null;
  for (;;) {
    let query: Query = build();
    for (const key of keys) query = query.order(key, { ascending: true });
    if (last) {
      const [a, b] = keys;
      const at = last as Record<string, unknown>;
      query =
        b === undefined
          ? query.gt(a, at[a])
          : query.or(`${a}.gt.${at[a]},and(${a}.eq.${at[a]},${b}.gt.${at[b]})`);
    }
    const { data, error } = await query.limit(PAGE);
    if (error) return { error: error.message };
    const page = (data ?? []) as unknown as T[];
    rows.push(...page);
    if (page.length < PAGE) return { data: rows };
    last = page[page.length - 1];
  }
};

const readTerms = async (
  client: DataClient,
  workUuid: string,
): Promise<Result<{ terms: ResolveTerm[]; termOf: Map<string, string> }>> => {
  type GlossaryRow = {
    uuid: string;
    work_uuid: string;
    authority_uuid: string;
    name_uuid: string;
    termType: string | null;
  };
  type EdgeRow = { parent_uuid: string; child_uuid: string };
  const columns = 'uuid, work_uuid, authority_uuid, name_uuid, termType';

  const own = await readAll<GlossaryRow>(() =>
    client.from('glossaries').select(columns).eq('work_uuid', workUuid),
  );
  if ('error' in own) return own;

  const edges: EdgeRow[] = [];
  for (const batch of inBatches(own.data.map((g) => g.uuid))) {
    const read = await readAll<EdgeRow>(
      () =>
        client
          .from('glossary_edges')
          .select('parent_uuid, child_uuid')
          .in('parent_uuid', batch),
      ['parent_uuid', 'child_uuid'],
    );
    if ('error' in read) return read;
    edges.push(...read.data);
  }

  // A term's child names normally belong to the same work; read any that do not.
  const known = new Map(own.data.map((g) => [g.uuid, g]));
  const foreign = [...new Set(edges.map((e) => e.child_uuid))].filter(
    (uuid) => !known.has(uuid),
  );
  for (const batch of inBatches(foreign)) {
    const read = await readAll<GlossaryRow>(() =>
      client.from('glossaries').select(columns).in('uuid', batch),
    );
    if ('error' in read) return read;
    read.data.forEach((g) => known.set(g.uuid, g));
  }

  const names = new Map<string, string>();
  const nameUuids = [...new Set([...known.values()].map((g) => g.name_uuid))];
  for (const batch of inBatches(nameUuids)) {
    const read = await readAll<{ uuid: string; content: string | null }>(() =>
      client.from('names').select('uuid, content').in('uuid', batch),
    );
    if ('error' in read) return read;
    read.data.forEach((n) => n.content && names.set(n.uuid, n.content));
  }

  return {
    data: assembleResolveTerms({
      workUuid,
      glossaries: [...known.values()],
      edges,
      names,
    }),
  };
};

/**
 * A work's terms from the draft base tables. A term is a glossary row with a
 * self-edge; its alternatives are the child names typed `translationAlternative`.
 * Pure.
 */
export const assembleResolveTerms = ({
  workUuid,
  glossaries,
  edges,
  names,
}: {
  workUuid: string;
  glossaries: {
    uuid: string;
    work_uuid: string;
    authority_uuid: string;
    name_uuid: string;
    termType: string | null;
  }[];
  edges: { parent_uuid: string; child_uuid: string }[];
  names: Map<string, string>;
}): { terms: ResolveTerm[]; termOf: Map<string, string> } => {
  const byUuid = new Map(glossaries.map((g) => [g.uuid, g]));
  const termUuids = new Set(
    edges
      .filter((e) => e.parent_uuid === e.child_uuid)
      .map((e) => e.parent_uuid)
      .filter((uuid) => {
        const g = byUuid.get(uuid);
        // As the snapshot's glossary: a term without its own name is not listed.
        return g?.work_uuid === workUuid && names.has(g.name_uuid);
      }),
  );

  const termOf = new Map([...termUuids].map((uuid) => [uuid, uuid]));
  const alternatives = new Map<string, Set<string>>();
  const sorted = [...edges].sort(
    (a, b) =>
      a.child_uuid.localeCompare(b.child_uuid) ||
      a.parent_uuid.localeCompare(b.parent_uuid),
  );
  for (const edge of sorted) {
    if (!termUuids.has(edge.parent_uuid)) continue;
    if (!termOf.has(edge.child_uuid))
      termOf.set(edge.child_uuid, edge.parent_uuid);
    const child = byUuid.get(edge.child_uuid);
    const name = child && names.get(child.name_uuid);
    if (edge.child_uuid === edge.parent_uuid || !name) continue;
    if (child.termType === 'translationAlternative') {
      const set = alternatives.get(edge.parent_uuid) ?? new Set();
      set.add(name);
      alternatives.set(edge.parent_uuid, set);
    }
  }

  const terms = [...termUuids].sort().flatMap((uuid) => {
    const g = byUuid.get(uuid);
    if (!g) return [];
    return {
      uuid,
      authorityUuid: g.authority_uuid,
      english: names.get(g.name_uuid) ?? null,
      alternatives: [...(alternatives.get(uuid) ?? [])].sort(),
    };
  });
  return { terms, termOf };
};

/**
 * Reads what the resolver matches over: every draft passage of the work, the
 * annotations that bear on a match, and the work's terms from the base tables
 * (not the glossary view, which only publish refreshes).
 */
export const readResolveInput = async ({
  client,
  workUuid,
}: {
  client: DataClient;
  workUuid: string;
}): Promise<Result<ResolveInput>> => {
  const passages = await readAll<ResolvePassage>(() =>
    client
      .from(relationFor('passages', 'draft'))
      .select('uuid, content, label, sort, type')
      .eq('work_uuid', workUuid),
  );
  if ('error' in passages) return passages;

  const annotations: ResolveAnnotation[] = [];
  for (const batch of inBatches(passages.data.map((p) => p.uuid))) {
    const read = await readAll<{
      uuid: string;
      passage_uuid: string;
      type: string;
      start: number;
      end: number;
      content: Record<string, unknown>[] | null;
    }>(() =>
      client
        .from(relationFor('passageAnnotations', 'draft'))
        .select('uuid, passage_uuid, type, start, end, content')
        .in('passage_uuid', batch)
        .in('type', [...RESOLVE_ANNOTATION_TYPES]),
    );
    if ('error' in read) return read;
    annotations.push(
      ...read.data.map((a) => ({
        uuid: a.uuid,
        passageUuid: a.passage_uuid,
        type: a.type,
        start: a.start,
        end: a.end,
        content: a.content ?? [],
      })),
    );
  }

  const terms = await readTerms(client, workUuid);
  if ('error' in terms) return terms;

  const ordered = [...passages.data].sort(
    (a, b) =>
      (a.sort ?? Number.MAX_SAFE_INTEGER) -
        (b.sort ?? Number.MAX_SAFE_INTEGER) || a.uuid.localeCompare(b.uuid),
  );
  return {
    data: {
      passages: ordered.map((p) => ({ ...p, content: p.content ?? '' })),
      annotations,
      terms: terms.data.terms,
      termOf: terms.data.termOf,
    },
  };
};

/** The current content and glossary instances of some passages. */
export interface GlossaryPassageState {
  /** Content by passage uuid; a passage that is gone is absent. */
  content: Map<string, string>;
  instances: ResolveAnnotation[];
}

/** Re-reads passages' content and glossary instances, as a write is about to see them. */
export const readGlossaryPassageState = async ({
  client,
  passageUuids,
}: {
  client: DataClient;
  passageUuids: string[];
}): Promise<Result<GlossaryPassageState>> => {
  const content = new Map<string, string>();
  const instances: ResolveAnnotation[] = [];
  for (const batch of inBatches(passageUuids)) {
    const passages = await readAll<{ uuid: string; content: string | null }>(
      () =>
        client
          .from(relationFor('passages', 'draft'))
          .select('uuid, content')
          .in('uuid', batch),
    );
    if ('error' in passages) return passages;
    passages.data.forEach((p) => content.set(p.uuid, p.content ?? ''));
    const read = await readAll<{
      uuid: string;
      passage_uuid: string;
      type: string;
      start: number;
      end: number;
      content: Record<string, unknown>[] | null;
    }>(() =>
      client
        .from(relationFor('passageAnnotations', 'draft'))
        .select('uuid, passage_uuid, type, start, end, content')
        .in('passage_uuid', batch)
        .eq('type', 'glossary-instance'),
    );
    if ('error' in read) return read;
    instances.push(
      ...read.data.map((a) => ({
        uuid: a.uuid,
        passageUuid: a.passage_uuid,
        type: a.type,
        start: a.start,
        end: a.end,
        content: a.content ?? [],
      })),
    );
  }
  return { data: { content, instances } };
};
