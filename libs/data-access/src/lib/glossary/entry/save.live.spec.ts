/**
 * @jest-environment node
 */
// Glossary entry saves against a local Supabase: the reads the planner
// depends on, and what the database stores. Skipped unless
// DATA_ACCESS_LIVE=1, with SUPABASE_URL (a local URL),
// SUPABASE_SERVICE_ROLE_KEY and, for the permission test, SUPABASE_ANON_KEY.
import { createClient } from '@supabase/supabase-js';
import { v4 as uuidv4 } from 'uuid';

import type { DataClient } from '../../types';
import { getGlossaryEntries, getGlossaryEntry } from './read';
import {
  createGlossaryEntry,
  deleteGlossaryEntry,
  saveGlossaryEntries,
  saveGlossaryEntry,
} from './save';
import {
  GLOSSARY_ATTESTATIONS,
  GLOSSARY_DEFINITION_RENDS,
  GLOSSARY_TERM_TYPES,
  type GlossaryEntry,
  type GlossaryEntryChange,
  type GlossaryEntryExpect,
  type GlossaryEntryName,
  type GlossaryEntryNameInput,
  type GlossarySaveResult,
} from './types';

const LIVE = process.env['DATA_ACCESS_LIVE'] === '1';
const describeLive = LIVE ? describe : describe.skip;

type Row = Record<string, unknown>;
type SaveOk = Extract<GlossarySaveResult, { success: true }>;

const uid = (): string => uuidv4();

const ZERO = {
  glossaries: { inserted: 0, updated: 0, deleted: 0 },
  glossaryEdges: { inserted: 0, deleted: 0 },
  names: { inserted: 0, updated: 0 },
  annotations: { deleted: 0 },
};

const clientOptions = {
  auth: { persistSession: false, autoRefreshToken: false },
};

/** The service and anon clients, refusing anything but a local Supabase. */
const liveClients = (): { db: DataClient; anon: DataClient | null } => {
  const url = process.env['SUPABASE_URL'] ?? '';
  const serviceKey = process.env['SUPABASE_SERVICE_ROLE_KEY'];
  const anonKey = process.env['SUPABASE_ANON_KEY'];
  const host = URL.canParse(url) ? new URL(url).hostname : '';
  if (host !== '127.0.0.1' && host !== 'localhost') {
    throw new Error('SUPABASE_URL must be a local Supabase (127.0.0.1)');
  }
  if (!serviceKey) throw new Error('SUPABASE_SERVICE_ROLE_KEY is not set');
  return {
    db: createClient(url, serviceKey, clientOptions),
    anon: anonKey ? createClient(url, anonKey, clientOptions) : null,
  };
};

const check = (error: { message: string } | null, what: string) => {
  if (error) throw new Error(`${what}: ${error.message}`);
};

const select = async (
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
  return ((data ?? []) as unknown as Row[]).sort((a, b) =>
    JSON.stringify(a) < JSON.stringify(b) ? -1 : 1,
  );
};

/**
 * What one spec writes: scratch works, authorities, names, rows, creators,
 * passages and annotations, removed again by `cleanup`.
 */
class Scratch {
  readonly tag = uid().slice(0, 8);
  readonly works: string[] = [];
  readonly authorities: string[] = [];
  private seq = 0;

  constructor(readonly db: DataClient) {}

  async work(): Promise<string> {
    const uuid = uid();
    const { error } = await this.db
      .from('works')
      .insert({ uuid, title: `data-access scratch ${this.tag}-${++this.seq}` });
    check(error, 'insert work');
    this.works.push(uuid);
    return uuid;
  }

  async authority(): Promise<string> {
    const uuid = uid();
    const n = ++this.seq;
    const { error } = await this.db.from('authorities').insert({
      uuid,
      xmlId: `data-access-${this.tag}-${n}`,
      headword: `data-access scratch authority ${this.tag}-${n}`,
    });
    check(error, 'insert authority');
    this.authorities.push(uuid);
    return uuid;
  }

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
    return uuid;
  }

  /** A `glossaries` row with its edge: from `rootUuid`, or a self-edge. */
  async row(args: {
    workUuid: string;
    authorityUuid: string;
    nameUuid: string;
    rootUuid?: string;
    termType?: string | null;
    attestation?: string | null;
  }): Promise<string> {
    const uuid = uid();
    const { error } = await this.db.from('glossaries').insert({
      uuid,
      work_uuid: args.workUuid,
      authority_uuid: args.authorityUuid,
      name_uuid: args.nameUuid,
      termType: args.termType ?? null,
      attestation: args.attestation ?? null,
    });
    check(error, 'insert glossaries row');
    const edge = await this.db
      .from('glossary_edges')
      .insert({ parent_uuid: args.rootUuid ?? uuid, child_uuid: uuid });
    check(edge.error, 'insert glossary_edges row');
    return uuid;
  }

  async passage(workUuid: string): Promise<string> {
    const uuid = uid();
    const { error } = await this.db.from('passages').insert({
      uuid,
      work_uuid: workUuid,
      label: `data-access-${++this.seq}`,
      sort: this.seq,
      type: 'translation',
      content: 'scratch',
    });
    check(error, 'insert passage');
    return uuid;
  }

  /** A `glossary-instance` annotation citing the given rows, as real ones do. */
  async annotation(passageUuid: string, ...rowUuids: string[]) {
    const uuid = uid();
    const { error } = await this.db.from('passage_annotations').insert({
      uuid,
      passage_uuid: passageUuid,
      type: 'glossary-instance',
      content: [
        { type: 'glossary' },
        ...rowUuids.map((u) => ({ uuid: u })),
        { authority: uid() },
      ],
      start: 0,
      end: 3,
    });
    check(error, 'insert annotation');
    return uuid;
  }

  /** The scratch works' glossary rows and the scratch authorities' names. */
  async snapshot() {
    const glossaries = await select(
      this.db,
      'glossaries',
      'work_uuid',
      this.works,
    );
    return {
      glossaries,
      edges: await select(
        this.db,
        'glossary_edges',
        'child_uuid',
        glossaries.map((g) => g['uuid'] as string),
      ),
      names: await select(this.db, 'names', 'authority_uuid', this.authorities),
    };
  }

  async cleanup(): Promise<void> {
    const db = this.db;
    const passages = (
      await select(db, 'passages', 'work_uuid', this.works, 'uuid')
    ).map((p) => p['uuid'] as string);
    const steps: [
      string,
      () => PromiseLike<{ error: { message: string } | null }>,
    ][] = [
      [
        'annotations',
        () =>
          db.from('passage_annotations').delete().in('passage_uuid', passages),
      ],
      [
        'passages',
        () => db.from('passages').delete().in('work_uuid', this.works),
      ],
      [
        'creators',
        () => db.from('creators').delete().in('work_uuid', this.works),
      ],
      // Edges go with their rows.
      [
        'glossaries',
        () => db.from('glossaries').delete().in('work_uuid', this.works),
      ],
      [
        'names',
        () => db.from('names').delete().in('authority_uuid', this.authorities),
      ],
      [
        'authorities',
        () => db.from('authorities').delete().in('uuid', this.authorities),
      ],
      ['works', () => db.from('works').delete().in('uuid', this.works)],
    ];
    for (const [what, run] of steps) {
      const { error } = await run();
      if (error) console.warn(`scratch cleanup (${what}): ${error.message}`);
    }
  }
}

const en = (
  content: string,
  o: Partial<GlossaryEntryNameInput> = {},
): GlossaryEntryNameInput => ({
  language: 'en',
  content,
  contentTransformed: null,
  termType: null,
  attestation: null,
  ...o,
});
const bo = (
  wylie: string,
  script: string,
  o: Partial<GlossaryEntryNameInput> = {},
) => en(wylie, { language: 'Bo-Ltn', contentTransformed: script, ...o });

const succeeded = (result: GlossarySaveResult): SaveOk => {
  if (!result.success) {
    throw new Error(
      `refused (${result.reason}${result.field ? `, ${result.field}` : ''}): ${result.error}`,
    );
  }
  return result;
};

const edit = (
  names: readonly GlossaryEntryName[],
  glossaryUuid: string,
  patch: Partial<GlossaryEntryName>,
): GlossaryEntryName[] =>
  names.map((x) => (x.glossaryUuid === glossaryUuid ? { ...x, ...patch } : x));

const nameOf = (entry: GlossaryEntry, content: string) => {
  const found = entry.names.find((x) => x.content === content);
  if (!found) throw new Error(`entry has no name "${content}"`);
  return found;
};

/** The change, and expect, that restate everything an entry holds. */
const restated = (
  e: GlossaryEntry,
): GlossaryEntryChange & GlossaryEntryExpect => ({
  authorityUuid: e.authorityUuid,
  definition: e.definition,
  definitionRend: e.definitionRend,
  glossMode: e.glossMode,
  names: e.names,
});

/** Counts `apply_glossary_save` calls, passing everything through. */
const countingApplies = (db: DataClient) => {
  let count = 0;
  const client = new Proxy(db, {
    get(target, prop) {
      if (prop === 'rpc') {
        return (fn: string, ...rest: unknown[]) => {
          if (fn === 'apply_glossary_save') count += 1;
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

describeLive('glossary entry saves against the database', () => {
  let db: DataClient;
  let anon: DataClient | null;
  let s: Scratch;
  let workA: string;
  let workB: string;
  let authA: string;
  let authB: string;
  let authC: string;

  beforeAll(async () => {
    ({ db, anon } = liveClients());
    s = new Scratch(db);
    workA = await s.work();
    workB = await s.work();
    authA = await s.authority();
    authB = await s.authority();
    authC = await s.authority();
  });

  afterAll(async () => {
    await s?.cleanup();
  });

  const makeEntry = async (args: {
    workUuid: string;
    authorityUuid: string;
    names: GlossaryEntryNameInput[];
    uuid?: string;
    definition?: string | null;
    definitionRend?: string | null;
    glossMode?: string | null;
  }): Promise<GlossaryEntry> =>
    succeeded(
      await createGlossaryEntry({
        client: db,
        workUuid: args.workUuid,
        entry: { ...args, uuid: args.uuid ?? uid() },
      }),
    ).entries[0];

  const readEntry = async (workUuid: string, uuid: string) => {
    const read = await getGlossaryEntry({ client: db, workUuid, uuid });
    if (read.status !== 'found')
      throw new Error(`${uuid} read as ${read.status}`);
    return read.entry;
  };

  const save = (
    workUuid: string,
    before: GlossaryEntry,
    after: GlossaryEntryChange,
    client = db,
  ) => saveGlossaryEntry({ client, workUuid, before, after });

  const nameRow = async (uuid: string) =>
    (await select(db, 'names', 'uuid', [uuid]))[0];

  const entryRows = async (root: string) => {
    const edges = await select(db, 'glossary_edges', 'parent_uuid', [root]);
    return select(
      db,
      'glossaries',
      'uuid',
      edges.map((e) => e['child_uuid'] as string),
    );
  };

  /** Saves an entry back unchanged three ways: no row changes, no apply. */
  const expectRoundTrips = async (workUuid: string, uuid: string) => {
    const entry = await readEntry(workUuid, uuid);
    const before = await s.snapshot();
    const { client, applies } = countingApplies(db);
    for (const result of [
      await save(workUuid, entry, {}, client),
      await save(workUuid, entry, restated(entry), client),
      await saveGlossaryEntries({
        client,
        workUuid,
        saves: [{ uuid, change: restated(entry), expect: restated(entry) }],
      }),
    ]) {
      const ok = succeeded(result);
      expect(ok.entries).toEqual([entry]);
      expect(ok.changes).toEqual(ZERO);
    }
    expect(applies()).toBe(0);
    expect(await s.snapshot()).toEqual(before);
  };

  it('copies a names row another entry uses instead of editing it, leaving that entry as it was', async () => {
    for (const [content, patch] of [
      ['shared term', { content: 'changed term' }],
      ['lang shared', { language: 'Sa-Ltn' }],
    ] as const) {
      const e1 = await makeEntry({
        workUuid: workA,
        authorityUuid: authA,
        names: [en(content), en(`${content} kept`)],
      });
      const shared = e1.names[0].nameUuid;
      const e2 = await makeEntry({
        workUuid: workB,
        authorityUuid: authA,
        names: [en(content, { nameUuid: shared })],
      });
      const e2Before = await readEntry(workB, e2.uuid);
      const e2Rows = await entryRows(e2.uuid);

      const result = succeeded(
        await save(workA, e1, { names: edit(e1.names, e1.uuid, patch) }),
      );
      const after = result.entries[0];
      expect(after.names[0]).toMatchObject({
        ...patch,
        nameAuthorityUuid: authA,
      });
      expect(after.names[0].nameUuid).not.toBe(shared);
      expect(nameOf(after, `${content} kept`).nameUuid).toBe(
        e1.names[1].nameUuid,
      );
      expect(result.changes.names).toEqual({ inserted: 1, updated: 0 });

      expect(await nameRow(shared)).toMatchObject({ language: 'en', content });
      expect(await readEntry(workB, e2.uuid)).toEqual(e2Before);
      expect(await entryRows(e2.uuid)).toEqual(e2Rows);
      expect(await readEntry(workA, e1.uuid)).toEqual(after);
    }
  });

  it('copies a names row a creator uses instead of editing it', async () => {
    const creatorName = await s.name({
      authorityUuid: authA,
      language: 'en',
      content: 'Translator Name',
    });
    const creator = await s.creator({
      workUuid: workA,
      authorityUuid: authA,
      nameUuid: creatorName,
    });
    const e1 = await makeEntry({
      workUuid: workA,
      authorityUuid: authA,
      names: [en('root'), en('Translator Name', { nameUuid: creatorName })],
    });
    const result = succeeded(
      await save(workA, e1, {
        names: edit(e1.names, nameOf(e1, 'Translator Name').glossaryUuid, {
          content: 'Translator Renamed',
        }),
      }),
    );
    expect(nameOf(result.entries[0], 'Translator Renamed').nameUuid).not.toBe(
      creatorName,
    );
    expect(await nameRow(creatorName)).toMatchObject({
      content: 'Translator Name',
    });
    expect((await select(db, 'creators', 'uuid', [creator]))[0]).toMatchObject({
      name_uuid: creatorName,
    });
  });

  it('relinks by moving names rows only the entry uses and copying the others once each', async () => {
    const n2 = await s.name({
      authorityUuid: authA,
      language: 'en',
      content: 'rel other work',
    });
    const n3 = await s.name({
      authorityUuid: authA,
      language: 'en',
      content: 'rel creator',
    });
    const n5 = await s.name({
      authorityUuid: authA,
      language: 'en',
      content: 'rel same work',
    });
    const n4 = await s.name({
      authorityUuid: authB,
      language: 'en',
      content: 'rel foreign',
    });
    const n6 = await s.name({
      authorityUuid: authC,
      language: 'en',
      content: 'rel already',
    });

    const e1 = await makeEntry({
      workUuid: workA,
      authorityUuid: authA,
      names: [
        en('rel root'),
        en('rel other work', { nameUuid: n2, attestation: 'attestedSource' }),
        en('rel creator', { nameUuid: n3 }),
        en('rel same work', { nameUuid: n5 }),
      ],
    });
    const dupRow = await s.row({
      workUuid: workA,
      authorityUuid: authA,
      nameUuid: n2,
      rootUuid: e1.uuid,
      attestation: 'attestedDictionary',
    });
    const foreignRow = await s.row({
      workUuid: workA,
      authorityUuid: authA,
      nameUuid: n4,
      rootUuid: e1.uuid,
    });
    const alreadyRow = await s.row({
      workUuid: workA,
      authorityUuid: authA,
      nameUuid: n6,
      rootUuid: e1.uuid,
    });
    const rootName = e1.names[0].nameUuid;
    const e2 = await makeEntry({
      workUuid: workB,
      authorityUuid: authA,
      names: [en('rel other work', { nameUuid: n2 })],
    });
    const e3 = await makeEntry({
      workUuid: workA,
      authorityUuid: authA,
      names: [en('rel same work', { nameUuid: n5 })],
    });
    await s.creator({ workUuid: workA, authorityUuid: authA, nameUuid: n3 });

    const before = await readEntry(workA, e1.uuid);
    expect(before.names).toHaveLength(7);
    const others = async () => [
      await readEntry(workB, e2.uuid),
      await entryRows(e2.uuid),
      await readEntry(workA, e3.uuid),
      await entryRows(e3.uuid),
    ];
    const othersBefore = await others();

    const after = succeeded(await save(workA, before, { authorityUuid: authC }))
      .entries[0];
    expect(after.authorityUuid).toBe(authC);
    const rows = await entryRows(e1.uuid);
    expect(rows).toHaveLength(7);
    expect(rows.every((row) => row['authority_uuid'] === authC)).toBe(true);
    expect(after.names.every((x) => x.nameAuthorityUuid === authC)).toBe(true);

    // Moved: the same names row, now in the new authority.
    expect(after.names[0].nameUuid).toBe(rootName);
    expect(
      after.names.find((x) => x.glossaryUuid === foreignRow)?.nameUuid,
    ).toBe(n4);
    expect(
      after.names.find((x) => x.glossaryUuid === alreadyRow)?.nameUuid,
    ).toBe(n6);
    for (const moved of [rootName, n4, n6]) {
      expect(await nameRow(moved)).toMatchObject({ authority_uuid: authC });
    }

    // Copied: one new names row each, the original left in place.
    for (const [content, original] of [
      ['rel other work', n2],
      ['rel creator', n3],
      ['rel same work', n5],
    ] as const) {
      const copies = after.names.filter((x) => x.content === content);
      expect(copies.length).toBeGreaterThan(0);
      expect(new Set(copies.map((c) => c.nameUuid)).size).toBe(1);
      expect(copies[0].nameUuid).not.toBe(original);
      const { count } = await db
        .from('names')
        .select('uuid', { count: 'exact', head: true })
        .eq('authority_uuid', authC)
        .eq('content', content);
      expect(count).toBe(1);
      expect(await nameRow(original)).toMatchObject({
        authority_uuid: authA,
        content,
      });
    }
    expect(after.names.find((x) => x.glossaryUuid === dupRow)).toMatchObject({
      attestation: 'attestedDictionary',
    });
    expect(await others()).toEqual(othersBefore);

    // It reads back the same, and round-trips.
    const read = await readEntry(workA, e1.uuid);
    expect(read).toEqual(after);
    expect(
      succeeded(
        await save(workA, read, { authorityUuid: authC, names: read.names }),
      ).changes,
    ).toEqual(ZERO);
  });

  it('round-trips legacy values, a Tibetan name without script and a foreign names row with no changes', async () => {
    const e = await makeEntry({
      workUuid: workA,
      authorityUuid: authA,
      definition: 'Legacy.',
      names: [en('rt legacy root'), en('rt legacy child'), bo('rt bo', 'བོ')],
    });
    const foreign = await s.name({
      authorityUuid: authB,
      language: 'en',
      content: 'rt foreign',
    });
    await s.row({
      workUuid: workA,
      authorityUuid: authA,
      nameUuid: foreign,
      rootUuid: e.uuid,
    });
    check(
      (
        await db
          .from('glossaries')
          .update({ definition_rend: 'bothWithStandard' })
          .eq('uuid', e.uuid)
      ).error,
      'update root',
    );
    check(
      (
        await db
          .from('glossaries')
          .update({
            attestation: 'attestedLegacyValue',
            termType: 'legacyType',
          })
          .eq('uuid', nameOf(e, 'rt legacy child').glossaryUuid)
      ).error,
      'update child',
    );
    check(
      (
        await db
          .from('names')
          .update({ content_transformed: null })
          .eq('uuid', nameOf(e, 'rt bo').nameUuid)
      ).error,
      'update name',
    );
    await expectRoundTrips(workA, e.uuid);
  });

  it('accepts every value in the fixed sets, and null, and reads them back', async () => {
    const attestations = [...GLOSSARY_ATTESTATIONS, null];
    const termTypes = [...GLOSSARY_TERM_TYPES, null];
    const e = await makeEntry({
      workUuid: workA,
      authorityUuid: authA,
      names: [
        en('all root'),
        ...attestations.map((a, i) =>
          en(`all attestation ${i}`, { attestation: a }),
        ),
        ...termTypes.map((t, i) => en(`all term type ${i}`, { termType: t })),
      ],
    });
    let current = await readEntry(workA, e.uuid);
    for (const [i, a] of attestations.entries()) {
      expect(nameOf(current, `all attestation ${i}`).attestation).toBe(a);
    }
    for (const [i, t] of termTypes.entries()) {
      expect(nameOf(current, `all term type ${i}`).termType).toBe(t);
    }
    for (const rend of [...GLOSSARY_DEFINITION_RENDS, null]) {
      current = succeeded(await save(workA, current, { definitionRend: rend }))
        .entries[0];
      expect(current.definitionRend).toBe(rend);
      expect((await readEntry(workA, e.uuid)).definitionRend).toBe(rend);
    }
    for (const [mode, expected] of [
      ['marked', 'marked'],
      ['match', 'match'],
      [null, 'match'],
    ] as const) {
      current = succeeded(await save(workA, current, { glossMode: mode }))
        .entries[0];
      expect(current.glossMode).toBe(expected);
      expect((await readEntry(workA, e.uuid)).glossMode).toBe(expected);
    }
  });

  it('refuses a row of another work as invalid, writing nothing', async () => {
    const e1 = await makeEntry({
      workUuid: workA,
      authorityUuid: authA,
      names: [en('here')],
    });
    const elsewhere = await makeEntry({
      workUuid: workB,
      authorityUuid: authA,
      names: [en('there'), en('there too')],
    });
    const before = await s.snapshot();
    const result = await save(workA, e1, {
      names: [
        ...e1.names,
        {
          ...en('there too'),
          glossaryUuid: nameOf(elsewhere, 'there too').glossaryUuid,
        },
      ],
    });
    expect(result).toMatchObject({
      success: false,
      reason: 'invalid',
      field: 'names[1].glossaryUuid',
    });
    expect(await s.snapshot()).toEqual(before);
  });

  it("reads entries in the order asked, leaving missing ones out, and only the root's entry-wide values", async () => {
    const [e1, e2, e3] = [
      await makeEntry({
        workUuid: workA,
        authorityUuid: authA,
        names: [en('one')],
      }),
      await makeEntry({
        workUuid: workA,
        authorityUuid: authA,
        names: [en('two')],
      }),
      await makeEntry({
        workUuid: workA,
        authorityUuid: authA,
        names: [en('three')],
      }),
    ];
    const found = await getGlossaryEntries({
      client: db,
      workUuid: workA,
      uuids: [e3.uuid, uid(), e1.uuid, e2.uuid],
    });
    expect(found?.map((e) => e.uuid)).toEqual([e3.uuid, e1.uuid, e2.uuid]);

    // A child row that (wrongly) carries entry-wide values of its own.
    const dirty = await s.work();
    const e = await makeEntry({
      workUuid: dirty,
      authorityUuid: authA,
      definition: 'Root definition.',
      definitionRend: 'prependWithStandard',
      glossMode: 'marked',
      names: [en('root'), en('child')],
    });
    check(
      (
        await db
          .from('glossaries')
          .update({
            definition: 'Child definition.',
            definition_rend: 'overrideWithStandard',
            glossMode: 'match',
          })
          .eq('uuid', nameOf(e, 'child').glossaryUuid)
      ).error,
      'update child',
    );
    expect(await readEntry(dirty, e.uuid)).toMatchObject({
      definition: 'Root definition.',
      definitionRend: 'prependWithStandard',
      glossMode: 'marked',
    });
  });

  it("counts a delete's citing annotations in this work, then reads the entry as not-found", async () => {
    const e = await makeEntry({
      workUuid: workA,
      authorityUuid: authA,
      names: [en('del root'), en('del child'), en('del other child')],
    });
    const [child, other] = [
      nameOf(e, 'del child').glossaryUuid,
      nameOf(e, 'del other child').glossaryUuid,
    ];
    const pA = await s.passage(workA);
    const pB = await s.passage(workB);
    const removed = [
      await s.annotation(pA, e.uuid),
      await s.annotation(pA, child),
      await s.annotation(pA, uid(), other),
      await s.annotation(pA, e.uuid, child),
    ];
    const kept = [
      await s.annotation(pB, e.uuid),
      await s.annotation(pA, uid()),
    ];

    const dry = succeeded(
      await deleteGlossaryEntry({
        client: db,
        workUuid: workA,
        uuid: e.uuid,
        dryRun: true,
      }),
    );
    expect(dry.changes.annotations.deleted).toBe(removed.length);

    const result = succeeded(
      await deleteGlossaryEntry({ client: db, workUuid: workA, uuid: e.uuid }),
    );
    expect(result.deleted).toEqual([e.uuid]);
    expect(result.changes).toEqual({
      glossaries: { inserted: 0, updated: 0, deleted: 3 },
      glossaryEdges: { inserted: 0, deleted: 3 },
      names: { inserted: 0, updated: 0 },
      annotations: { deleted: removed.length },
    });
    expect(await select(db, 'passage_annotations', 'uuid', removed)).toEqual(
      [],
    );
    expect(await select(db, 'passage_annotations', 'uuid', kept)).toHaveLength(
      2,
    );
    expect(
      await getGlossaryEntry({ client: db, workUuid: workA, uuid: e.uuid }),
    ).toEqual({ status: 'not-found' });

    const again = await makeEntry({
      workUuid: workA,
      authorityUuid: authA,
      uuid: e.uuid,
      names: [en('del again new')],
    });
    expect(again.uuid).toBe(e.uuid);
  });

  it('refuses a caller without permission as forbidden, writing nothing', async () => {
    if (!anon) {
      console.warn(
        'SUPABASE_ANON_KEY is not set: skipping the anonymous-caller test',
      );
      return;
    }
    const e = await makeEntry({
      workUuid: workA,
      authorityUuid: authA,
      definition: 'Guarded.',
      names: [en('guard root')],
    });
    const before = await s.snapshot();
    expect(
      await save(workA, e, { definition: 'Vandalised.' }, anon),
    ).toMatchObject({
      success: false,
      reason: 'forbidden',
    });
    expect(await s.snapshot()).toEqual(before);
  });
});
