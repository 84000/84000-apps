/**
 * @jest-environment node
 */
// Copying a glossary entry from another work against a local Supabase.
// Skipped unless DATA_ACCESS_LIVE=1. Environment (from `supabase status -o
// env` in infra/): SUPABASE_URL (API_URL, and it must be local),
// SUPABASE_SERVICE_ROLE_KEY (SERVICE_ROLE_KEY), SUPABASE_ANON_KEY (ANON_KEY)
// and SUPABASE_JWT_SECRET (JWT_SECRET).
//
// `search_entities` refuses the service role, so the operations run as the
// seeded editor (an HS256 JWT sent with the anon key). The service client
// writes fixtures and checks what was stored. Everything written is tagged,
// and removed in afterAll.
import { createHmac } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';
import { v4 as uuidv4 } from 'uuid';

import type { DataClient } from '../../types';
import { getWorkGlossaryTermsPage } from '../pagination';
import {
  copyGlossaryEntry,
  getGlossaryEntriesOfAuthority,
  searchGlossaryEntriesToCopy,
  type GlossaryCopySource,
} from './copy';
import { getGlossaryEntry } from './read';
import { createGlossaryEntry, saveGlossaryEntry } from './save';
import type {
  GlossaryEntry,
  GlossaryEntryNameInput,
  GlossarySaveResult,
} from './types';

const LIVE = process.env['DATA_ACCESS_LIVE'] === '1';
const describeLive = LIVE ? describe : describe.skip;

type Row = Record<string, unknown>;
type SaveOk = Extract<GlossarySaveResult, { success: true }>;

const uid = (): string => uuidv4();

const EDITOR_ID = '33333333-3333-3333-3333-333333333333';
// A seeded role that has editor.read but not editor.edit.
const MANAGER_ID = '22222222-2222-2222-2222-222222222222';

const clientOptions = {
  auth: { persistSession: false, autoRefreshToken: false },
};

const env = (...names: string[]): string | undefined =>
  names.map((name) => process.env[name]).find(Boolean);

const b64 = (value: object) =>
  Buffer.from(JSON.stringify(value)).toString('base64url');

/** A Supabase auth JWT for a seeded user, signed with the local secret. */
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

/** The clients, refusing anything but a local Supabase. */
const liveClients = () => {
  const url = env('SUPABASE_URL', 'API_URL') ?? '';
  const serviceKey = env('SUPABASE_SERVICE_ROLE_KEY', 'SERVICE_ROLE_KEY');
  const anonKey = env('SUPABASE_ANON_KEY', 'ANON_KEY');
  const secret = env('SUPABASE_JWT_SECRET', 'JWT_SECRET');
  const host = URL.canParse(url) ? new URL(url).hostname : '';
  if (host !== '127.0.0.1' && host !== 'localhost') {
    throw new Error('SUPABASE_URL must be a local Supabase (127.0.0.1)');
  }
  if (!serviceKey) throw new Error('SUPABASE_SERVICE_ROLE_KEY is not set');
  if (!anonKey) throw new Error('SUPABASE_ANON_KEY is not set');
  if (!secret) throw new Error('SUPABASE_JWT_SECRET is not set');
  const as = (sub: string, userRole: string): DataClient =>
    createClient(url, anonKey, {
      ...clientOptions,
      global: {
        headers: { Authorization: `Bearer ${signJwt(secret, sub, userRole)}` },
      },
    });
  return {
    db: createClient(url, serviceKey, clientOptions) as DataClient,
    anon: createClient(url, anonKey, clientOptions) as DataClient,
    editor: as(EDITOR_ID, 'editor'),
    manager: as(MANAGER_ID, 'manager'),
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

/** What the spec writes, removed again by `cleanup`. */
class Scratch {
  readonly tag = uid().replace(/-/g, '').slice(0, 8);
  readonly works: string[] = [];
  readonly authorities: string[] = [];
  private seq = 0;

  constructor(readonly db: DataClient) {}

  async work(title: string, toh: string): Promise<string> {
    const uuid = uid();
    const { error } = await this.db
      .from('works')
      .insert({ uuid, title: `${title} ${this.tag}`, toh });
    check(error, 'insert work');
    this.works.push(uuid);
    return uuid;
  }

  async authority(headword: string, language: string): Promise<string> {
    const uuid = uid();
    const { error } = await this.db.from('authorities').insert({
      uuid,
      xmlId: `copy-spec-${this.tag}-${++this.seq}`,
      headword,
      headword_language: language,
    });
    check(error, 'insert authority');
    this.authorities.push(uuid);
    return uuid;
  }

  async passage(workUuid: string): Promise<string> {
    const uuid = uid();
    const { error } = await this.db.from('passages').insert({
      uuid,
      work_uuid: workUuid,
      label: `copy-spec-${++this.seq}`,
      sort: this.seq,
      type: 'translation',
      content: 'scratch',
    });
    check(error, 'insert passage');
    return uuid;
  }

  /** A `glossary-instance` annotation citing the given rows, as real ones do. */
  async instance(passageUuid: string, ...rowUuids: string[]) {
    const { error } = await this.db.from('passage_annotations').insert({
      uuid: uid(),
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
  }

  /** Every table row a copy could touch, for the scratch works and authorities. */
  async snapshot(works = this.works) {
    const glossaries = await select(this.db, 'glossaries', 'work_uuid', works);
    const rowUuids = glossaries.map((g) => g['uuid'] as string);
    const passages = await select(this.db, 'passages', 'work_uuid', works);
    return {
      works: await select(this.db, 'works', 'uuid', works),
      glossaries,
      edges: await select(this.db, 'glossary_edges', 'child_uuid', rowUuids),
      // Every names row of the scratch authorities: a copy adds none.
      names: await select(this.db, 'names', 'authority_uuid', this.authorities),
      authorities: await select(
        this.db,
        'authorities',
        'uuid',
        this.authorities,
      ),
      passages,
      annotations: await select(
        this.db,
        'passage_annotations',
        'passage_uuid',
        passages.map((p) => p['uuid'] as string),
      ),
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

const name = (
  language: string,
  content: string,
  o: Partial<GlossaryEntryNameInput> = {},
): GlossaryEntryNameInput => ({
  language,
  content,
  contentTransformed: null,
  termType: null,
  attestation: null,
  ...o,
});

const succeeded = (result: GlossarySaveResult): SaveOk => {
  if (!result.success) {
    throw new Error(
      `refused (${result.reason}${result.field ? `, ${result.field}` : ''}): ${result.error}`,
    );
  }
  return result;
};

/** A name's stored values, apart from the row that links it to its entry. */
const nameValues = (entry: GlossaryEntry) =>
  entry.names.map((n) => ({
    nameUuid: n.nameUuid,
    nameAuthorityUuid: n.nameAuthorityUuid,
    language: n.language,
    content: n.content,
    contentTransformed: n.contentTransformed,
    termType: n.termType,
    attestation: n.attestation,
  }));

// Tibetan script no other entry holds. Its syllables are indexed one by one.
const TIBETAN = 'ཀླུ་ཡི་རྒྱལ་པོ';

describeLive('copying a glossary entry from another work', () => {
  let db: DataClient;
  let anon: DataClient;
  let editor: DataClient;
  let manager: DataClient;
  let s: Scratch;

  // The tag is part of every searchable word, so only the scratch rows match.
  let mango: string;
  let sanskrit: string;
  let wylie: string;

  let srcWork: string;
  let otherWork: string;
  let target: string;
  let authMango: string;
  let authGrove: string;
  let authBare: string;
  let authTargetOnly: string;
  let authFirst: string;
  let authLast: string;

  let source: GlossaryEntry; // src work: mango, authMango, every field set
  let aardvark: GlossaryEntry; // src work: sorts before mango
  let grove: GlossaryEntry; // other work: authGrove, no glossMode set
  let bare: GlossaryEntry; // other work: authBare, nothing but a name
  let existing: GlossaryEntry; // target: already holds authMango
  let twin: GlossaryEntry; // target: shares every search word with source
  let apple: GlossaryEntry; // target: sorts before mango
  let zucchini: GlossaryEntry; // target: sorts after mango

  const make = async (
    workUuid: string,
    authorityUuid: string,
    names: GlossaryEntryNameInput[],
    rest: {
      definition?: string | null;
      definitionRend?: string | null;
      glossMode?: string | null;
    } = {},
  ): Promise<GlossaryEntry> =>
    succeeded(
      await createGlossaryEntry({
        client: db,
        workUuid,
        entry: { uuid: uid(), authorityUuid, names, ...rest },
      }),
    ).entries[0];

  const read = async (workUuid: string, uuid: string) => {
    const found = await getGlossaryEntry({ client: db, workUuid, uuid });
    if (found.status !== 'found') throw new Error(`${uuid}: ${found.status}`);
    return found.entry;
  };

  const search = (query: string, extra: { limit?: number } = {}) =>
    searchGlossaryEntriesToCopy({
      client: editor,
      workUuid: target,
      query,
      ...extra,
    });

  const found = async (query: string): Promise<GlossaryCopySource[]> => {
    const results = await search(query);
    if (!results) throw new Error(`search for "${query}" failed`);
    return results;
  };

  const uuidsOf = (results: GlossaryCopySource[]) =>
    results.map((r) => r.entry.uuid);

  beforeAll(async () => {
    ({ db, anon, editor, manager } = liveClients());
    s = new Scratch(db);
    const tag = s.tag;
    mango = `mango${tag}`;
    sanskrit = `śūnya${tag}`;
    wylie = `snyingpo${tag}`;
    const digits = parseInt(tag.slice(0, 5), 16) % 100000;

    srcWork = await s.work('Copy source work', `toh9${digits}`);
    otherWork = await s.work('Copy other work', `toh8${digits}`);
    target = await s.work('Copy target work', `toh7${digits}`);

    authMango = await s.authority(`${mango}-headword`, 'Sa-Ltn');
    authGrove = await s.authority(`grove${tag}-headword`, 'Sa-Ltn');
    authBare = await s.authority(`bare${tag}-headword`, 'en');
    authTargetOnly = await s.authority(`twin${tag}-headword`, 'Sa-Ltn');
    authFirst = await s.authority(`apple${tag}-headword`, 'en');
    authLast = await s.authority(`zucchini${tag}-headword`, 'en');
    const authAardvark = await s.authority(`aardvark${tag}-headword`, 'en');

    source = await make(
      srcWork,
      authMango,
      [
        name('en', mango, { termType: 'translationMain' }),
        name('en', `mangosteen${tag}`, {
          termType: 'translationAlternative',
          attestation: 'attestedApproximate',
        }),
        name('Sa-Ltn', sanskrit, { attestation: 'attestedSource' }),
        name('Bo-Ltn', wylie, {
          contentTransformed: TIBETAN,
          attestation: 'attestedDictionary',
        }),
      ],
      {
        definition: `<p>A tropical fruit ${tag}, the start of a long definition. ${'More words follow. '.repeat(40)}</p>`,
        definitionRend: 'prependWithStandard',
        glossMode: 'marked',
      },
    );
    aardvark = await make(srcWork, authAardvark, [
      name('en', `aardvark${tag}`),
    ]);
    grove = await make(
      otherWork,
      authGrove,
      [name('en', `${mango} grove`), name('Sa-Ltn', `vana${tag}`)],
      {
        definition: '<p>A grove of them.</p>',
        definitionRend: 'overrideWithStandard',
      },
    );
    bare = await make(otherWork, authBare, [name('en', `bare${tag}`)]);

    existing = await make(target, authMango, [name('en', `ambrosia${tag}`)], {
      definition: '<p>Already here.</p>',
    });
    twin = await make(target, authTargetOnly, [
      name('en', `${mango} twin`),
      name('Sa-Ltn', sanskrit),
      name('Bo-Ltn', wylie, { contentTransformed: TIBETAN }),
    ]);
    apple = await make(target, authFirst, [name('en', `apple${tag}`)]);
    zucchini = await make(target, authLast, [name('en', `zucchini${tag}`)]);

    // The source has instances in its own passages; a copy must not.
    await s.instance(
      await s.passage(srcWork),
      ...source.names.map((n) => n.glossaryUuid),
    );
    await s.passage(target);
  });

  afterAll(async () => {
    await s?.cleanup();
  });

  describe('searching other works', () => {
    it('finds an entry by its English name, in every other work, never in this one', async () => {
      const results = await found(mango);
      const uuids = uuidsOf(results);
      expect(uuids).toEqual(expect.arrayContaining([source.uuid, grove.uuid]));
      // The twin and `existing` are this work's: not offered for copying.
      for (const own of [twin, existing, apple, zucchini]) {
        expect(uuids).not.toContain(own.uuid);
      }
      expect(results.every((r) => r.work.uuid !== target)).toBe(true);
      expect(results.every((r) => r.entry.workUuid !== target)).toBe(true);
    });

    it('finds an entry by its Sanskrit name', async () => {
      const results = await found(sanskrit);
      expect(uuidsOf(results)).toEqual([source.uuid]);
    });

    it('finds an entry by its Tibetan name, in Wylie or in script', async () => {
      expect(uuidsOf(await found(wylie))).toEqual([source.uuid]);
      expect(uuidsOf(await found(TIBETAN))).toEqual([source.uuid]);
    });

    it('shows each result with its work, its names, its definition and its authority', async () => {
      const results = await found(mango);
      const result = results.find((r) => r.entry.uuid === source.uuid);
      if (!result) throw new Error('the source was not found');
      const { work, entry, headword, headwordLanguage, label } = result;

      // The work: its Toh and title.
      expect(work.uuid).toBe(srcWork);
      expect(work.toh).toContain(
        `9${parseInt(s.tag.slice(0, 5), 16) % 100000}`,
      );
      expect(work.title).toBe(`Copy source work ${s.tag}`);

      // The entry, whole: names of every language, and the definition.
      expect(entry).toEqual(await read(srcWork, source.uuid));
      expect(entry.names.map((n) => n.content)).toEqual(
        expect.arrayContaining([mango, sanskrit, wylie]),
      );
      expect(entry.definition).toContain('the start of a long definition');

      // Its authority's headword.
      expect(headword).toBe(`${mango}-headword`);
      expect(headwordLanguage).toBe('Sa-Ltn');

      // Its label in its own work's glossary: aardvark sorts first.
      const page = await getWorkGlossaryTermsPage({
        client: db,
        workUuid: srcWork,
        source: 'draft',
      });
      const numbers = new Map(page.nodes.map((n) => [n.uuid, n.termNumber]));
      expect(numbers.get(aardvark.uuid)).toBe(1);
      expect(label).toBe(`g.${numbers.get(source.uuid)}`);
      expect(label).toBe('g.2');
    });

    it('does not list this work, whichever work that is', async () => {
      const results = await searchGlossaryEntriesToCopy({
        client: editor,
        workUuid: srcWork,
        query: mango,
      });
      const uuids = uuidsOf(results ?? []);
      expect(uuids).not.toContain(source.uuid);
      // The target's entries are another work's now.
      expect(uuids).toEqual(expect.arrayContaining([grove.uuid, twin.uuid]));
    });

    it('returns an empty list when nothing matches', async () => {
      expect(await search(`nomatch${s.tag}`)).toEqual([]);
    });

    it('returns no more than the limit', async () => {
      const all = await found(mango);
      expect(all.length).toBeGreaterThanOrEqual(2);
      const one = await search(mango, { limit: 1 });
      expect(one).toHaveLength(1);
    });

    it('returns null, not an empty list, when the search is refused', async () => {
      // `search_entities` is gated on editor.read: no session, no search.
      const refused = await searchGlossaryEntriesToCopy({
        client: anon,
        workUuid: target,
        query: mango,
      });
      expect(refused).toBeNull();
    });
  });

  describe('finding what this work already has', () => {
    it("lists this work's entries of an authority, and only this work's", async () => {
      const here = await getGlossaryEntriesOfAuthority({
        client: editor,
        workUuid: target,
        authorityUuid: authMango,
      });
      // The source entry, in another work, has the same authority.
      expect(here?.map((e) => e.uuid)).toEqual([existing.uuid]);
      expect(here?.[0]).toEqual(await read(target, existing.uuid));

      const there = await getGlossaryEntriesOfAuthority({
        client: editor,
        workUuid: srcWork,
        authorityUuid: authMango,
      });
      expect(there?.map((e) => e.uuid)).toEqual([source.uuid]);
    });

    it('lists nothing for an authority this work has no entry for', async () => {
      expect(
        await getGlossaryEntriesOfAuthority({
          client: editor,
          workUuid: target,
          authorityUuid: authGrove,
        }),
      ).toEqual([]);
    });
  });

  describe('copying', () => {
    let beforeSource: Awaited<ReturnType<Scratch['snapshot']>>;
    let beforeOthers: Awaited<ReturnType<Scratch['snapshot']>>;
    let sourceBefore: GlossaryEntry;
    let copy: GlossaryEntry;
    let groveCopy: GlossaryEntry;
    let bareCopy: GlossaryEntry;
    let bareUuid: string;
    let copied: SaveOk;
    let targetBefore: Row[];

    beforeAll(async () => {
      sourceBefore = await read(srcWork, source.uuid);
      beforeSource = await s.snapshot([srcWork, otherWork]);
      beforeOthers = beforeSource;
      targetBefore = (await s.snapshot([target])).glossaries;

      // The target already has an entry for this authority: copying anyway.
      copied = succeeded(
        await copyGlossaryEntry({
          client: editor,
          workUuid: target,
          source: sourceBefore,
        }),
      );
      copy = copied.entries[0];
      groveCopy = succeeded(
        await copyGlossaryEntry({
          client: editor,
          workUuid: target,
          source: await read(otherWork, grove.uuid),
        }),
      ).entries[0];
      bareUuid = uid();
      bareCopy = succeeded(
        await copyGlossaryEntry({
          client: editor,
          workUuid: target,
          source: await read(otherWork, bare.uuid),
          uuid: bareUuid,
        }),
      ).entries[0];
    });

    describe('what a copy carries', () => {
      it('is a new entry of this work, on the same authority', () => {
        expect(copy.uuid).not.toBe(source.uuid);
        expect(copy.workUuid).toBe(target);
        expect(copy.authorityUuid).toBe(authMango);
        expect(copied.entries).toHaveLength(1);
        expect(copied.deleted).toEqual([]);
        expect(copied.dryRun).toBe(false);
      });

      it('carries the definition, how it combines with the standard, and the matching mode', () => {
        expect(copy.definition).toBe(sourceBefore.definition);
        expect(copy.definitionRend).toBe('prependWithStandard');
        expect(copy.glossMode).toBe('marked');
        expect(groveCopy.definition).toBe('<p>A grove of them.</p>');
        expect(groveCopy.definitionRend).toBe('overrideWithStandard');
      });

      it('carries a matching mode that was never set as it reads, not as null', () => {
        expect(grove.glossMode).toBe('match');
        expect(groveCopy.glossMode).toBe('match');
      });

      it('carries a bare entry without inventing a definition', () => {
        expect(bareCopy.uuid).toBe(bareUuid);
        expect(bareCopy.definition).toBeNull();
        expect(bareCopy.definitionRend).toBeNull();
        expect(bareCopy.glossMode).toBe('match');
        expect(bareCopy.names).toHaveLength(1);
      });

      it('carries every name with its attestation and term type, as the same names rows', () => {
        // Same name uuids, in the same order, root first.
        expect(nameValues(copy)).toEqual(nameValues(sourceBefore));
        expect(copy.names.map((n) => n.nameUuid)).toEqual(
          sourceBefore.names.map((n) => n.nameUuid),
        );
        expect(copy.names[0].content).toBe(mango);
        expect(copy.names.map((n) => n.termType)).toEqual(
          sourceBefore.names.map((n) => n.termType),
        );
        expect(copy.names.map((n) => n.attestation)).toEqual(
          sourceBefore.names.map((n) => n.attestation),
        );
        // The Tibetan script travels with its Wylie.
        expect(copy.names.find((n) => n.content === wylie)).toMatchObject({
          language: 'Bo-Ltn',
          contentTransformed: TIBETAN,
          attestation: 'attestedDictionary',
        });
        expect(nameValues(groveCopy).map((n) => n.nameUuid)).toEqual(
          grove.names.map((n) => n.nameUuid),
        );
      });

      it("links those names with rows of its own, not the source's", async () => {
        const sourceRows = new Set(
          sourceBefore.names.map((n) => n.glossaryUuid),
        );
        for (const n of copy.names) {
          expect(sourceRows.has(n.glossaryUuid)).toBe(false);
        }
        const edges = await select(db, 'glossary_edges', 'parent_uuid', [
          copy.uuid,
        ]);
        expect(edges.map((e) => e['child_uuid']).sort()).toEqual(
          copy.names.map((n) => n.glossaryUuid).sort(),
        );
        const rows = await select(
          db,
          'glossaries',
          'uuid',
          copy.names.map((n) => n.glossaryUuid),
        );
        expect(rows.every((r) => r['work_uuid'] === target)).toBe(true);
        expect(rows.every((r) => r['authority_uuid'] === authMango)).toBe(true);
        expect(rows.map((r) => r['name_uuid']).sort()).toEqual(
          sourceBefore.names.map((n) => n.nameUuid).sort(),
        );
      });

      it('stores what it returns', async () => {
        expect(await read(target, copy.uuid)).toEqual(copy);
        expect(await read(target, groveCopy.uuid)).toEqual(groveCopy);
        expect(await read(target, bareCopy.uuid)).toEqual(bareCopy);
      });

      it("adds no names rows: a copy reuses the source's", async () => {
        const after = await s.snapshot([srcWork, otherWork]);
        expect(after.names).toEqual(beforeOthers.names);
      });
    });

    describe('the source is untouched', () => {
      it('leaves the source entry as it was read', async () => {
        expect(await read(srcWork, source.uuid)).toEqual(sourceBefore);
        expect(await read(otherWork, grove.uuid)).toEqual(grove);
        expect(await read(otherWork, bare.uuid)).toEqual(bare);
      });

      it('leaves the source work, its glossary rows, edges, names, authorities, passages and instances as they were', async () => {
        const after = await s.snapshot([srcWork, otherWork]);
        expect(after).toEqual(beforeSource);
      });
    });

    describe('the copy in this work', () => {
      it('appears in glossary order, with the entries around it', async () => {
        const page = await getWorkGlossaryTermsPage({
          client: db,
          workUuid: target,
          source: 'draft',
        });
        const order = page.nodes.map((n) => n.uuid);
        // apple < ambrosia-less names: the copy's English name is "mango…".
        expect(order.indexOf(copy.uuid)).toBeGreaterThan(
          order.indexOf(apple.uuid),
        );
        expect(order.indexOf(copy.uuid)).toBeLessThan(
          order.indexOf(zucchini.uuid),
        );
        expect(order.indexOf(copy.uuid)).toBeGreaterThanOrEqual(0);
        // It is numbered like any entry: g.N with N its place.
        const at = page.nodes.findIndex((n) => n.uuid === copy.uuid);
        const node = page.nodes[at];
        expect(node?.termNumber).toBe(at + 1);
        expect(node?.names.english).toBe(mango);
        // And the entries it joined are all still there.
        for (const own of [existing, twin, apple, zucchini]) {
          expect(order).toContain(own.uuid);
        }
      });

      it('has no instances', async () => {
        const rows = copy.names.map((n) => n.glossaryUuid);
        const passages = await select(db, 'passages', 'work_uuid', [
          target,
          srcWork,
        ]);
        const annotations = await select(
          db,
          'passage_annotations',
          'passage_uuid',
          passages.map((p) => p['uuid'] as string),
        );
        const cited = JSON.stringify(annotations);
        for (const row of rows) expect(cited).not.toContain(row);
        // The source's own instances are still there, citing the source.
        for (const n of sourceBefore.names) {
          expect(cited).toContain(n.glossaryUuid);
        }
      });

      it("leaves this work's other entries as they were", async () => {
        const after = await s.snapshot([target]);
        const copyRows = new Set(
          [...copy.names, ...groveCopy.names, ...bareCopy.names].map(
            (n) => n.glossaryUuid,
          ),
        );
        expect(
          after.glossaries.filter((g) => !copyRows.has(g['uuid'] as string)),
        ).toEqual(targetBefore);
        expect(await read(target, existing.uuid)).toEqual(existing);
      });

      it('is listed beside the entry that already had its authority', async () => {
        const here = await getGlossaryEntriesOfAuthority({
          client: editor,
          workUuid: target,
          authorityUuid: authMango,
        });
        expect(here?.map((e) => e.uuid).sort()).toEqual(
          [existing.uuid, copy.uuid].sort(),
        );
      });

      it('is no longer offered for copying into this work', async () => {
        const results = await found(mango);
        expect(uuidsOf(results)).not.toContain(copy.uuid);
        expect(uuidsOf(results)).toContain(source.uuid);
      });

      it("can be edited without changing the source: names and definition are the entry's own once changed", async () => {
        const before = await read(otherWork, grove.uuid);
        const rowsBefore = await s.snapshot([otherWork]);
        const sharedName = groveCopy.names[0];

        const saved = succeeded(
          await saveGlossaryEntry({
            client: editor,
            workUuid: target,
            before: groveCopy,
            after: {
              definition: '<p>Rewritten in this work.</p>',
              names: groveCopy.names.map((n) =>
                n.glossaryUuid === sharedName.glossaryUuid
                  ? { ...n, content: `renamed${s.tag}` }
                  : n,
              ),
            },
          }),
        ).entries[0];

        expect(saved.definition).toBe('<p>Rewritten in this work.</p>');
        expect(saved.names[0].content).toBe(`renamed${s.tag}`);
        // The shared names row was not rewritten under the source.
        expect(saved.names[0].nameUuid).not.toBe(sharedName.nameUuid);

        expect(await read(otherWork, grove.uuid)).toEqual(before);
        expect(await s.snapshot([otherWork])).toEqual({
          ...rowsBefore,
          // The copy of the name is a new names row of the same authority.
          names: expect.arrayContaining(rowsBefore.names),
        });
        const stored = await select(db, 'names', 'uuid', [sharedName.nameUuid]);
        expect(stored[0]).toMatchObject({ content: `${mango} grove` });
      });
    });

    describe('permission', () => {
      it('refuses a caller who may read the editor but not edit it, writing nothing', async () => {
        const before = await s.snapshot([target, srcWork]);
        const result = await copyGlossaryEntry({
          client: manager,
          workUuid: target,
          source: await read(srcWork, aardvark.uuid),
        });
        expect(result).toMatchObject({ success: false, reason: 'forbidden' });
        expect(await s.snapshot([target, srcWork])).toEqual(before);
      });
    });
  });

  describe('a name owned by another authority', () => {
    it('is written anew with the same text, and the rest are linked', async () => {
      const owner = await s.authority(`Owner ${mango}`, 'Sa-Ltn');
      const elsewhere = await s.authority(`Elsewhere ${mango}`, 'Sa-Ltn');
      const own = await make(srcWork, owner, [
        name('en', `Owned ${mango}`, { termType: 'translationMain' }),
        name('Sa-Ltn', `owned${s.tag}`, { attestation: 'attestedDictionary' }),
      ]);
      const moved = own.names[1];
      check(
        (
          await db
            .from('names')
            .update({ authority_uuid: elsewhere })
            .eq('uuid', moved.nameUuid)
        ).error,
        'move name',
      );

      const copy = succeeded(
        await copyGlossaryEntry({
          client: editor,
          workUuid: target,
          source: await read(srcWork, own.uuid),
        }),
      ).entries[0];

      const [root, other] = copy.names;
      expect(root.nameUuid).toBe(own.names[0].nameUuid);
      expect(other).toMatchObject({
        language: 'Sa-Ltn',
        content: `owned${s.tag}`,
        attestation: 'attestedDictionary',
        nameAuthorityUuid: owner,
      });
      expect(other.nameUuid).not.toBe(moved.nameUuid);
      const { data } = await db
        .from('names')
        .select('authority_uuid')
        .eq('uuid', moved.nameUuid)
        .single();
      expect(data).toEqual({ authority_uuid: elsewhere });
    });
  });
});
