/**
 * Fixtures for the glossary live acceptance spec: clients for a local
 * Supabase, and scratch rows (works, authorities, names, glossary entries)
 * that `Scratch.cleanup` removes again, including the authorities the ops
 * under test create. The data-access spec has its own copy (a lib cannot
 * import another lib's source).
 *
 * Environment, from `supabase status -o env` in infra: SUPABASE_URL (local
 * only), SUPABASE_SERVICE_ROLE_KEY, SUPABASE_ANON_KEY and SUPABASE_JWT_SECRET.
 */
import { createHmac, randomUUID } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';

import type { DataClient } from '@eightyfourthousand/data-access';

export type Row = Record<string, unknown>;

export const uid = (): string => randomUUID();

/** Set DATA_ACCESS_LIVE=1 to run the live specs. */
export const LIVE = process.env['DATA_ACCESS_LIVE'] === '1';

const clientOptions = {
  auth: { persistSession: false, autoRefreshToken: false },
};

/** A seeded local user whose role is `editor`. */
const EDITOR_USER = '33333333-3333-3333-3333-333333333333';

const b64 = (value: unknown) =>
  Buffer.from(JSON.stringify(value)).toString('base64url');

/** A JWT the local stack accepts, for a signed-in user with the given role. */
const signJwt = (secret: string, sub: string, userRole: string): string => {
  const now = Math.floor(Date.now() / 1000);
  const head = b64({ alg: 'HS256', typ: 'JWT' });
  const body = b64({
    sub,
    role: 'authenticated',
    aud: 'authenticated',
    user_role: userRole,
    iat: now,
    exp: now + 3600,
  });
  const sig = createHmac('sha256', secret)
    .update(`${head}.${body}`)
    .digest('base64url');
  return `${head}.${body}.${sig}`;
};

export type LiveClients = {
  /** Service role: fixtures and checks. */
  db: DataClient;
  /** A signed-in user whose role has editor.edit. */
  editor: DataClient;
};

/** The clients, refusing anything but a local Supabase. */
export const liveClients = (): LiveClients => {
  const url = process.env['SUPABASE_URL'] ?? '';
  const serviceKey = process.env['SUPABASE_SERVICE_ROLE_KEY'];
  const anonKey = process.env['SUPABASE_ANON_KEY'];
  const secret = process.env['SUPABASE_JWT_SECRET'];
  const host = URL.canParse(url) ? new URL(url).hostname : '';
  if (host !== '127.0.0.1' && host !== 'localhost') {
    throw new Error('SUPABASE_URL must be a local Supabase (127.0.0.1)');
  }
  if (!serviceKey) throw new Error('SUPABASE_SERVICE_ROLE_KEY is not set');
  if (!anonKey) throw new Error('SUPABASE_ANON_KEY is not set');
  if (!secret) {
    throw new Error(
      'SUPABASE_JWT_SECRET is not set (supabase status -o env, JWT_SECRET)',
    );
  }
  const signedIn = (sub: string, role: string) =>
    createClient(url, anonKey, {
      ...clientOptions,
      global: {
        headers: { Authorization: `Bearer ${signJwt(secret, sub, role)}` },
      },
    });
  return {
    db: createClient(url, serviceKey, clientOptions),
    editor: signedIn(EDITOR_USER, 'editor'),
  };
};

export const check = (error: { message: string } | null, what: string) => {
  if (error) throw new Error(`${what}: ${error.message}`);
};

const byJson = (a: Row, b: Row) =>
  JSON.stringify(a) < JSON.stringify(b) ? -1 : 1;

export const select = async (
  db: DataClient,
  table: string,
  column: string,
  values: readonly string[],
  columns = '*',
): Promise<Row[]> => {
  if (!values.length) return [];
  const { data, error } = await db
    .from(table)
    .select(columns)
    .in(column, values);
  check(error, `select ${table}`);
  return ((data ?? []) as unknown as Row[]).sort(byJson);
};

/**
 * What one spec writes. Every row carries the spec's `tag` (works by title,
 * authorities by headword), so `cleanup` also finds authorities an op created
 * that the spec never learned the uuid of.
 */
export class Scratch {
  readonly tag = uid().slice(0, 8);
  readonly works: string[] = [];
  readonly authorities: string[] = [];
  private seq = 0;

  constructor(readonly db: DataClient) {}

  /** A headword or title that carries this spec's tag. */
  label(what: string): string {
    return `glossary-live ${this.tag} ${what}`;
  }

  async work(): Promise<string> {
    const uuid = uid();
    const { error } = await this.db
      .from('works')
      .insert({ uuid, title: this.label(`work ${++this.seq}`) });
    check(error, 'insert work');
    this.works.push(uuid);
    return uuid;
  }

  /** An authority the spec makes itself. */
  async authority(): Promise<string> {
    const uuid = uid();
    const n = ++this.seq;
    const { error } = await this.db.from('authorities').insert({
      uuid,
      xmlId: `glossary-live-${this.tag}-${n}`,
      headword: this.label(`authority ${n}`),
    });
    check(error, 'insert authority');
    this.authorities.push(uuid);
    return uuid;
  }

  /** Registers an authority an op under test will create. */
  track(authorityUuid: string): string {
    this.authorities.push(authorityUuid);
    return authorityUuid;
  }

  async name(args: {
    authorityUuid: string;
    language: string;
    content: string;
    contentTransformed?: string | null;
  }): Promise<string> {
    const uuid = uid();
    const { error } = await this.db.from('names').insert({
      uuid,
      authority_uuid: args.authorityUuid,
      language: args.language,
      content: args.content,
      content_transformed: args.contentTransformed ?? null,
    });
    check(error, 'insert name');
    return uuid;
  }

  /**
   * A `glossaries` row with its edge: from `rootUuid` (a name of that entry),
   * or a self-edge (an entry's root).
   */
  async row(args: {
    workUuid: string;
    authorityUuid: string;
    nameUuid: string;
    rootUuid?: string;
    uuid?: string;
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

  /** The spec's authorities: the ones registered and any carrying its tag. */
  async allAuthorities(): Promise<string[]> {
    const { data, error } = await this.db
      .from('authorities')
      .select('uuid')
      .ilike('headword', `%${this.tag}%`);
    check(error, 'select tagged authorities');
    return [
      ...new Set([
        ...this.authorities,
        ...(data ?? []).map((a) => a.uuid as string),
      ]),
    ];
  }

  /** The works' glossary rows and names, and the authorities. */
  async snapshot() {
    const authorities = await this.allAuthorities();
    const glossaries = await select(
      this.db,
      'glossaries',
      'work_uuid',
      this.works,
    );
    return {
      authorities: await select(this.db, 'authorities', 'uuid', authorities),
      glossaries,
      edges: await select(
        this.db,
        'glossary_edges',
        'child_uuid',
        glossaries.map((g) => g['uuid'] as string),
      ),
      names: await select(this.db, 'names', 'authority_uuid', authorities),
    };
  }

  /** Everything the spec still holds in the database, for the final check. */
  async leftovers(): Promise<Record<string, number>> {
    const authorities = await this.allAuthorities();
    const count = async (rows: Promise<Row[]>) => (await rows).length;
    return {
      works: await count(select(this.db, 'works', 'uuid', this.works)),
      authorities: await count(
        select(this.db, 'authorities', 'uuid', authorities),
      ),
      names: await count(
        select(this.db, 'names', 'authority_uuid', authorities),
      ),
      glossaries: await count(
        select(this.db, 'glossaries', 'work_uuid', this.works),
      ),
    };
  }

  async cleanup(): Promise<void> {
    const db = this.db;
    const authorities = await this.allAuthorities();
    const glossaries = (
      await select(db, 'glossaries', 'work_uuid', this.works, 'uuid')
    ).map((g) => g['uuid'] as string);
    const steps: [
      string,
      () => PromiseLike<{ error: { message: string } | null }>,
    ][] = [
      [
        'edges',
        () => db.from('glossary_edges').delete().in('child_uuid', glossaries),
      ],
      [
        'glossaries',
        () => db.from('glossaries').delete().in('work_uuid', this.works),
      ],
      [
        'names',
        () => db.from('names').delete().in('authority_uuid', authorities),
      ],
      [
        'authorities',
        () => db.from('authorities').delete().in('uuid', authorities),
      ],
      ['works', () => db.from('works').delete().in('uuid', this.works)],
    ];
    for (const [what, run] of steps) {
      const { error } = await run();
      if (error) console.warn(`scratch cleanup (${what}): ${error.message}`);
    }
  }
}
