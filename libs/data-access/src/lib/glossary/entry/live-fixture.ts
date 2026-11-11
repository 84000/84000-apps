/**
 * DEV-880 acceptance suite: shared support for the live specs (the ones that
 * run against a local Supabase). Not a spec itself, and it uses no Jest
 * globals, so it stays out of the way of the library build.
 *
 * Live specs are skipped unless `DEV880_LIVE=1`, and refuse to run unless
 * `SUPABASE_URL` is a local URL (127.0.0.1 or localhost). Keys come from the
 * environment: `SUPABASE_SERVICE_ROLE_KEY`, and optionally `SUPABASE_ANON_KEY`.
 *
 *   cd infra && supabase status -o json     # API_URL, ANON_KEY, SERVICE_ROLE_KEY
 */
import { createClient } from '@supabase/supabase-js';
import { v4 as uuidv4 } from 'uuid';
import {
  createGlossaryEntry,
  getGlossaryEntry,
  saveGlossaryEntry,
  type DataClient,
  type GlossaryEntry,
  type GlossaryEntryChange,
  type GlossaryEntryName,
  type GlossaryEntryNameInput,
  type GlossarySaveResult,
} from '../../../index';

export type Row = Record<string, unknown>;
export type SaveOk = Extract<GlossarySaveResult, { success: true }>;
export type SaveFailure = Extract<GlossarySaveResult, { success: false }>;
export type NameList = (GlossaryEntryNameInput | GlossaryEntryName)[];

export const LIVE = process.env['DEV880_LIVE'] === '1';

export const uid = (): string => uuidv4();

// ---------------------------------------------------------------- environment

export type LiveEnv = { url: string; serviceKey: string; anonKey?: string };

/** Reads the environment, and refuses anything that is not a local Supabase. */
export const liveEnv = (): LiveEnv => {
  const url = process.env['SUPABASE_URL'];
  const serviceKey = process.env['SUPABASE_SERVICE_ROLE_KEY'];
  if (!url) {
    throw new Error(
      'DEV880_LIVE=1 needs SUPABASE_URL (the local API, http://127.0.0.1:54321)',
    );
  }
  let host: string;
  try {
    host = new URL(url).hostname;
  } catch {
    throw new Error(`SUPABASE_URL is not a URL: ${url}`);
  }
  if (host !== '127.0.0.1' && host !== 'localhost') {
    throw new Error(
      `Refusing to run the DEV-880 live suite against ${host}: SUPABASE_URL must be 127.0.0.1 or localhost`,
    );
  }
  if (!serviceKey) {
    throw new Error('DEV880_LIVE=1 needs SUPABASE_SERVICE_ROLE_KEY');
  }
  return { url, serviceKey, anonKey: process.env['SUPABASE_ANON_KEY'] };
};

const clientOptions = {
  auth: { persistSession: false, autoRefreshToken: false },
};

export const serviceClient = (env: LiveEnv): DataClient =>
  createClient(env.url, env.serviceKey, clientOptions);

export const anonClient = (env: LiveEnv): DataClient | null =>
  env.anonKey ? createClient(env.url, env.anonKey, clientOptions) : null;

// ---------------------------------------------------------------- raw reads

const check = (error: { message: string } | null, what: string) => {
  if (error) throw new Error(`${what}: ${error.message}`);
};

const chunk = <T>(values: readonly T[], size = 40): T[][] => {
  const out: T[][] = [];
  for (let i = 0; i < values.length; i += size) {
    out.push(values.slice(i, i + size));
  }
  return out;
};

/** `select <columns> from <table> where <column> in (<values>)`, chunked. */
export const selectIn = async (
  db: DataClient,
  table: string,
  column: string,
  values: readonly string[],
  columns = '*',
): Promise<Row[]> => {
  const out: Row[] = [];
  for (const part of chunk(values)) {
    const { data, error } = await db
      .from(table)
      .select(columns)
      .in(column, part);
    check(error, `select ${table}`);
    out.push(...((data ?? []) as unknown as Row[]));
  }
  return out;
};

const GLOSSARY_COLUMNS =
  'uuid,work_uuid,authority_uuid,name_uuid,definition,definition_rend,termType,attestation,glossMode,xmlId,verified';
const NAME_COLUMNS =
  'uuid,authority_uuid,language,content,content_transformed,internal';

const byKey = (keys: string[]) => (a: Row, b: Row) => {
  const ka = keys.map((k) => String(a[k])).join('|');
  const kb = keys.map((k) => String(b[k])).join('|');
  return ka < kb ? -1 : ka > kb ? 1 : 0;
};

export const glossaryRows = async (
  db: DataClient,
  uuids: readonly string[],
): Promise<Row[]> =>
  (await selectIn(db, 'glossaries', 'uuid', uuids, GLOSSARY_COLUMNS)).sort(
    byKey(['uuid']),
  );

export const nameRows = async (
  db: DataClient,
  uuids: readonly string[],
): Promise<Row[]> =>
  (await selectIn(db, 'names', 'uuid', uuids, NAME_COLUMNS)).sort(
    byKey(['uuid']),
  );

export const nameRow = async (
  db: DataClient,
  uuid: string,
): Promise<Row | null> => (await nameRows(db, [uuid]))[0] ?? null;

/** The edges whose parent is one of `parents`. */
export const edgesFrom = async (
  db: DataClient,
  parents: readonly string[],
): Promise<Row[]> =>
  (await selectIn(db, 'glossary_edges', 'parent_uuid', parents)).sort(
    byKey(['parent_uuid', 'child_uuid']),
  );

/** The edges whose child is one of `children`. */
export const edgesTo = async (
  db: DataClient,
  children: readonly string[],
): Promise<Row[]> =>
  (await selectIn(db, 'glossary_edges', 'child_uuid', children)).sort(
    byKey(['parent_uuid', 'child_uuid']),
  );

/** Every `glossaries` row of an entry as stored: its root and its children. */
export const storedEntryRows = async (
  db: DataClient,
  rootUuid: string,
): Promise<{ rows: Row[]; edges: Row[] }> => {
  const edges = await edgesFrom(db, [rootUuid]);
  const ids = [
    ...new Set([rootUuid, ...edges.map((e) => e['child_uuid'] as string)]),
  ];
  return { rows: await glossaryRows(db, ids), edges };
};

export const authorityRows = async (
  db: DataClient,
  uuids: readonly string[],
): Promise<Row[]> =>
  (
    await selectIn(
      db,
      'authorities',
      'uuid',
      uuids,
      'uuid,xmlId,headword,headword_language,label,definition',
    )
  ).sort(byKey(['uuid']));

/** How many `names` rows an authority has with this content. */
export const countNames = async (
  db: DataClient,
  authorityUuid: string,
  content: string,
): Promise<number> => {
  const { count, error } = await db
    .from('names')
    .select('uuid', { count: 'exact', head: true })
    .eq('authority_uuid', authorityUuid)
    .eq('content', content);
  check(error, 'count names');
  return count ?? 0;
};

export const countNamesOfAuthority = async (
  db: DataClient,
  authorityUuid: string,
): Promise<number> => {
  const { count, error } = await db
    .from('names')
    .select('uuid', { count: 'exact', head: true })
    .eq('authority_uuid', authorityUuid);
  check(error, 'count names');
  return count ?? 0;
};

// ---------------------------------------------------------------- scratch data

/**
 * Everything one spec creates: scratch works, authorities, creators, passages
 * and annotations, all tagged, and removed again by `cleanup`. Entries made
 * through data-access live in the scratch works and use scratch authorities,
 * so `cleanup` removes them (and their `names`) by those two scopes.
 */
export class Scratch {
  readonly tag = uid().slice(0, 8);
  readonly works: string[] = [];
  readonly authorities: string[] = [];
  readonly creators: string[] = [];
  private seq = 0;

  constructor(readonly db: DataClient) {}

  async work(): Promise<string> {
    const uuid = uid();
    const { error } = await this.db
      .from('works')
      .insert({ uuid, title: `dev880 scratch work ${this.tag}-${++this.seq}` });
    check(error, 'insert work');
    this.works.push(uuid);
    return uuid;
  }

  async authority(): Promise<string> {
    const uuid = uid();
    const n = ++this.seq;
    const { error } = await this.db.from('authorities').insert({
      uuid,
      xmlId: `dev880-${this.tag}-${n}`,
      headword: `dev880 scratch authority ${this.tag}-${n}`,
    });
    check(error, 'insert authority');
    this.authorities.push(uuid);
    return uuid;
  }

  /** A `names` row, made directly (an existing name the editor can link). */
  async name(args: {
    authorityUuid: string;
    language: string;
    content: string;
    contentTransformed?: string | null;
    internal?: boolean | null;
  }): Promise<string> {
    const uuid = uid();
    const { error } = await this.db.from('names').insert({
      uuid,
      authority_uuid: args.authorityUuid,
      language: args.language,
      content: args.content,
      content_transformed: args.contentTransformed ?? null,
      internal: args.internal ?? null,
    });
    check(error, 'insert name');
    return uuid;
  }

  /** A `creators` row pointing at a `names` row. */
  async creator(args: {
    workUuid: string;
    authorityUuid: string;
    nameUuid: string;
  }): Promise<string> {
    const uuid = uid();
    const { error } = await this.db.from('creators').insert({
      uuid,
      authority_uuid: args.authorityUuid,
      work_uuid: args.workUuid,
      type: 'translator',
      name_uuid: args.nameUuid,
    });
    check(error, 'insert creator');
    this.creators.push(uuid);
    return uuid;
  }

  /**
   * A `glossaries` row made directly, with its edge: a self-edge when it has
   * no `rootUuid` (it is a root), otherwise an edge from the root. This is
   * how a fixture gets data in the shapes DEV-908 left in place.
   */
  async row(args: {
    workUuid: string;
    authorityUuid: string;
    nameUuid: string;
    uuid?: string;
    rootUuid?: string;
    termType?: string | null;
    attestation?: string | null;
    definition?: string | null;
    definitionRend?: string | null;
    glossMode?: string | null;
  }): Promise<string> {
    const uuid = args.uuid ?? uid();
    const { error } = await this.db.from('glossaries').insert({
      uuid,
      work_uuid: args.workUuid,
      authority_uuid: args.authorityUuid,
      name_uuid: args.nameUuid,
      termType: args.termType ?? null,
      attestation: args.attestation ?? null,
      definition: args.definition ?? null,
      definition_rend: args.definitionRend ?? null,
      glossMode: args.glossMode ?? null,
    });
    check(error, 'insert glossaries row');
    const edge = await this.db
      .from('glossary_edges')
      .insert({ parent_uuid: args.rootUuid ?? uuid, child_uuid: uuid });
    check(edge.error, 'insert glossary_edges row');
    return uuid;
  }

  /** A passage in a scratch work. */
  async passage(workUuid: string): Promise<string> {
    const uuid = uid();
    const { error } = await this.db.from('passages').insert({
      uuid,
      work_uuid: workUuid,
      label: `dev880-${++this.seq}`,
      sort: this.seq,
      type: 'translation',
      content: 'scratch',
    });
    check(error, 'insert passage');
    return uuid;
  }

  /**
   * A `glossary-instance` annotation on a passage citing the given rows. The
   * content has the shape the real ones have: an array of one-key objects,
   * the cited uuid(s) after the leading `type` element.
   */
  async annotation(
    passageUuid: string,
    ...rowUuids: string[]
  ): Promise<string> {
    const uuid = uid();
    const content = [
      { type: 'glossary' },
      ...rowUuids.map((u) => ({ uuid: u })),
      { authority: uid() },
    ];
    const { error } = await this.db.from('passage_annotations').insert({
      uuid,
      passage_uuid: passageUuid,
      type: 'glossary-instance',
      content,
      start: 0,
      end: 3,
    });
    check(error, 'insert annotation');
    return uuid;
  }

  /** The annotations (all types) on the passages of the scratch works. */
  async annotations(): Promise<Row[]> {
    const passages = await this.passages();
    return (
      await selectIn(
        this.db,
        'passage_annotations',
        'passage_uuid',
        passages,
        'uuid,passage_uuid,type,content,start,end',
      )
    ).sort(byKey(['uuid']));
  }

  async annotationUuids(): Promise<string[]> {
    return (await this.annotations()).map((a) => a['uuid'] as string);
  }

  private async passages(): Promise<string[]> {
    if (!this.works.length) return [];
    const { data, error } = await this.db
      .from('passages')
      .select('uuid')
      .in('work_uuid', this.works);
    check(error, 'select passages');
    return (data ?? []).map((r) => (r as Row)['uuid'] as string);
  }

  /** Every `glossaries` row in the scratch works. */
  async glossaryRows(): Promise<Row[]> {
    if (!this.works.length) return [];
    const { data, error } = await this.db
      .from('glossaries')
      .select(GLOSSARY_COLUMNS)
      .in('work_uuid', this.works);
    check(error, 'select glossaries');
    return ((data ?? []) as unknown as Row[]).sort(byKey(['uuid']));
  }

  /** Every `names` row of the scratch authorities. */
  async nameRows(): Promise<Row[]> {
    if (!this.authorities.length) return [];
    const { data, error } = await this.db
      .from('names')
      .select(NAME_COLUMNS)
      .in('authority_uuid', this.authorities);
    check(error, 'select names');
    return ((data ?? []) as unknown as Row[]).sort(byKey(['uuid']));
  }

  async cleanup(): Promise<void> {
    const steps: [
      string,
      () => PromiseLike<{ error: { message: string } | null }>,
    ][] = [];
    const db = this.db;
    const passages = await this.passages().catch(() => [] as string[]);
    if (passages.length) {
      for (const part of chunk(passages)) {
        steps.push([
          'annotations',
          () =>
            db.from('passage_annotations').delete().in('passage_uuid', part),
        ]);
      }
    }
    if (this.works.length) {
      steps.push([
        'passages',
        () => db.from('passages').delete().in('work_uuid', this.works),
      ]);
      steps.push([
        'creators',
        () => db.from('creators').delete().in('work_uuid', this.works),
      ]);
      // Edges go with their rows (ON DELETE CASCADE).
      steps.push([
        'glossaries',
        () => db.from('glossaries').delete().in('work_uuid', this.works),
      ]);
    }
    if (this.authorities.length) {
      steps.push([
        'names',
        () => db.from('names').delete().in('authority_uuid', this.authorities),
      ]);
      steps.push([
        'authorities',
        () => db.from('authorities').delete().in('uuid', this.authorities),
      ]);
    }
    if (this.works.length) {
      steps.push([
        'works',
        () => db.from('works').delete().in('uuid', this.works),
      ]);
    }
    for (const [what, run] of steps) {
      const { error } = await run();
      if (error)
        console.warn(`DEV-880 scratch cleanup (${what}): ${error.message}`);
    }
  }
}

// ---------------------------------------------------------------- snapshots

export type Snapshot = {
  glossaries: Row[];
  edges: Row[];
  names: Row[];
  creators: Row[];
  authorities: Row[];
  /** Authorities that are not scratch ones: a save must not add or remove any. */
  otherAuthorities: number;
  annotations: Row[];
};

/** All the rows the suite's scratch scope holds, for "nothing changed". */
export const snapshot = async (s: Scratch): Promise<Snapshot> => {
  const glossaries = await s.glossaryRows();
  const ids = glossaries.map((g) => g['uuid'] as string);
  const edges = [
    ...(await edgesFrom(s.db, ids)),
    ...(await edgesTo(s.db, ids)),
  ];
  const seen = new Set<string>();
  const uniqueEdges = edges
    .filter((e) => {
      const key = `${e['parent_uuid']}>${e['child_uuid']}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .sort(byKey(['parent_uuid', 'child_uuid']));
  const creators = s.works.length
    ? (
        await selectIn(
          s.db,
          'creators',
          'work_uuid',
          s.works,
          'uuid,authority_uuid,work_uuid,type,name_uuid',
        )
      ).sort(byKey(['uuid']))
    : [];
  const { count, error } = await s.db
    .from('authorities')
    .select('uuid', { count: 'exact', head: true })
    .not('xmlId', 'like', 'dev880-%');
  check(error, 'count authorities');
  return {
    glossaries,
    edges: uniqueEdges,
    names: await s.nameRows(),
    creators,
    authorities: await authorityRows(s.db, s.authorities),
    otherAuthorities: count ?? 0,
    annotations: await s.annotations(),
  };
};

/**
 * Violations of the shape every entry must have after a save (criteria 2, 8
 * and 10): each `glossaries` row of the scratch works belongs to exactly one
 * entry, the entry's rows all sit in its authority, and entry-wide values are
 * on the root only. Empty when clean. Do not call it on a work where the test
 * itself planted a row that breaks one of these.
 */
export const integrity = async (s: Scratch): Promise<string[]> => {
  const rows = await s.glossaryRows();
  const byUuid = new Map(rows.map((r) => [r['uuid'] as string, r]));
  const edges = await edgesFrom(s.db, [...byUuid.keys()]);
  const parentsOf = new Map<string, string[]>();
  const childrenOf = new Map<string, string[]>();
  const out: string[] = [];
  for (const e of edges) {
    const p = e['parent_uuid'] as string;
    const c = e['child_uuid'] as string;
    if (!byUuid.has(c))
      out.push(`edge ${p} > ${c}: child is not a row of the work`);
    parentsOf.set(c, [...(parentsOf.get(c) ?? []), p]);
    childrenOf.set(p, [...(childrenOf.get(p) ?? []), c]);
  }
  const roots = new Set(
    [...byUuid.keys()].filter((u) => (childrenOf.get(u) ?? []).includes(u)),
  );
  for (const [uuid, row] of byUuid) {
    const parents = parentsOf.get(uuid) ?? [];
    if (parents.length !== 1) {
      out.push(`row ${uuid} has ${parents.length} incoming edges, not one`);
      continue;
    }
    const root = parents[0];
    if (!roots.has(root)) {
      out.push(`row ${uuid} hangs from ${root}, which is not a root`);
      continue;
    }
    if (root !== uuid && childrenOf.has(uuid)) {
      out.push(`child row ${uuid} is the parent of an edge`);
    }
    const rootRow = byUuid.get(root);
    if (rootRow && rootRow['authority_uuid'] !== row['authority_uuid']) {
      out.push(`row ${uuid} is in a different authority from its root ${root}`);
    }
    if (root !== uuid) {
      for (const col of ['definition', 'definition_rend', 'glossMode']) {
        if (row[col] !== null) out.push(`child row ${uuid} carries ${col}`);
      }
    }
  }
  return out;
};

// ---------------------------------------------------------------- entries

export const nm = {
  en: (
    content: string,
    o: Partial<GlossaryEntryNameInput> = {},
  ): GlossaryEntryNameInput => ({
    language: 'en',
    content,
    contentTransformed: null,
    termType: null,
    attestation: null,
    ...o,
  }),
  sa: (
    content: string,
    o: Partial<GlossaryEntryNameInput> = {},
  ): GlossaryEntryNameInput => ({
    language: 'Sa-Ltn',
    content,
    contentTransformed: null,
    termType: null,
    attestation: null,
    ...o,
  }),
  bo: (
    wylie: string,
    script: string,
    o: Partial<GlossaryEntryNameInput> = {},
  ): GlossaryEntryNameInput => ({
    language: 'Bo-Ltn',
    content: wylie,
    contentTransformed: script,
    termType: null,
    attestation: null,
    ...o,
  }),
};

export const expectSuccess = (
  result: GlossarySaveResult,
  what = 'save',
): SaveOk => {
  if (!result.success) {
    throw new Error(
      `${what} was refused (${result.reason}${result.field ? `, ${result.field}` : ''}): ${result.error}`,
    );
  }
  return result;
};

/**
 * Asserts a refusal with this reason (and, when given, this field), and
 * returns it. `reason` may be a list when the spec leaves the choice open.
 */
export const expectRefusal = (
  result: GlossarySaveResult,
  reason: SaveFailure['reason'] | SaveFailure['reason'][],
  field?: string | RegExp,
): SaveFailure => {
  if (result.success) {
    throw new Error(
      `expected a refusal (${String(reason)}), but the save succeeded`,
    );
  }
  const reasons = Array.isArray(reason) ? reason : [reason];
  if (!reasons.includes(result.reason)) {
    throw new Error(
      `expected ${reasons.join(' or ')}, got ${result.reason} (${result.field ?? 'no field'}): ${result.error}`,
    );
  }
  if (field !== undefined) {
    const got = result.field ?? '';
    const ok = typeof field === 'string' ? got === field : field.test(got);
    if (!ok) {
      throw new Error(
        `expected field ${String(field)}, got ${got || 'none'}: ${result.error}`,
      );
    }
  }
  return result;
};

/** Create an entry with the service role through `createGlossaryEntry`. */
export const makeEntry = async (
  db: DataClient,
  args: {
    workUuid: string;
    authorityUuid: string;
    names: GlossaryEntryNameInput[];
    uuid?: string;
    definition?: string | null;
    definitionRend?: string | null;
    glossMode?: string | null;
  },
): Promise<GlossaryEntry> => {
  const result = await createGlossaryEntry({
    client: db,
    workUuid: args.workUuid,
    entry: {
      uuid: args.uuid ?? uid(),
      authorityUuid: args.authorityUuid,
      definition: args.definition,
      definitionRend: args.definitionRend,
      glossMode: args.glossMode,
      names: args.names,
    },
  });
  const ok = expectSuccess(result, 'creating a fixture entry');
  return ok.entries[0];
};

export const readEntry = async (
  db: DataClient,
  workUuid: string,
  uuid: string,
): Promise<GlossaryEntry> => {
  const read = await getGlossaryEntry({ client: db, workUuid, uuid });
  if (read.status !== 'found') {
    throw new Error(`entry ${uuid} read as ${read.status}`);
  }
  return read.entry;
};

/** `saveGlossaryEntry` with a before and an after, as the editor calls it. */
export const saveChange = (
  db: DataClient,
  workUuid: string,
  before: GlossaryEntry,
  after: GlossaryEntryChange,
): Promise<GlossarySaveResult> =>
  saveGlossaryEntry({ client: db, workUuid, before, after });

/** The names list with one row's fields replaced. */
export const editName = (
  names: readonly GlossaryEntryName[],
  glossaryUuid: string,
  patch: Partial<GlossaryEntryNameInput>,
): NameList =>
  names.map((n) => (n.glossaryUuid === glossaryUuid ? { ...n, ...patch } : n));

export const nameOf = (
  entry: GlossaryEntry,
  content: string,
): GlossaryEntryName => {
  const found = entry.names.find((n) => n.content === content);
  if (!found) throw new Error(`entry has no name "${content}"`);
  return found;
};

/** The `names` uuids an entry's rows point at, from the database. */
export const storedNameUuids = async (
  db: DataClient,
  rootUuid: string,
): Promise<string[]> => {
  const { rows } = await storedEntryRows(db, rootUuid);
  return rows.map((r) => r['name_uuid'] as string);
};

export const zeroChanges = {
  glossaries: { inserted: 0, updated: 0, deleted: 0 },
  glossaryEdges: { inserted: 0, deleted: 0 },
  names: { inserted: 0, updated: 0 },
  annotations: { deleted: 0 },
};

// ---------------------------------------------------------------- interception

/**
 * Wraps a client so that `apply_glossary_save` calls can be counted and a
 * hook can run right before the first one reaches the database: a concurrent
 * writer landing between data-access's read and its apply. Everything else is
 * passed straight through.
 */
export const interceptApply = (
  db: DataClient,
  beforeFirstApply?: () => Promise<void>,
): { client: DataClient; applies: () => number } => {
  let count = 0;
  const client = new Proxy(db, {
    get(target, prop) {
      if (prop === 'rpc') {
        return async (fn: string, ...rest: unknown[]) => {
          if (fn === 'apply_glossary_save') {
            count += 1;
            if (count === 1 && beforeFirstApply) await beforeFirstApply();
          }
          return (target.rpc as (...a: unknown[]) => unknown).call(
            target,
            fn,
            ...rest,
          );
        };
      }
      const value = Reflect.get(target, prop, target);
      return typeof value === 'function' ? value.bind(target) : value;
    },
  });
  return { client: client as DataClient, applies: () => count };
};
