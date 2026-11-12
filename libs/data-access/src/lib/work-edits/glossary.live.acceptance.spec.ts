/**
 * @jest-environment node
 */
// Acceptance tests for the glossary group of `applyWorkEdits`, against a
// local Supabase. Written from the issue and its interface alone.
//
// Done-when criteria (named in the test titles):
//   AC1  an entry with names and a new authority: dry run, apply, read back
//   AC2  a patch with a stale `expect` is refused and writes nothing
//   AC3  renaming an entry whose names row another work shares leaves the
//        other work's entry unchanged
//   AC4  a new authority as an account without editor.edit is refused by the
//        database, and neither row is written
//
// Skipped unless DATA_ACCESS_LIVE=1. Needs SUPABASE_URL (local),
// SUPABASE_SERVICE_ROLE_KEY, SUPABASE_ANON_KEY and SUPABASE_JWT_SECRET.
import { getGlossaryEntry } from '../glossary/entry/read';
import type { DataClient } from '../types';
import { applyWorkEdits } from './apply-work-edits';
import { WORK_EDIT_GROUPS } from './types';
import {
  LIVE,
  Scratch,
  liveClients,
  select,
  uid,
  type LiveClients,
  type Row,
} from './glossary.live.acceptance-fixture';

const describeLive = LIVE ? describe : describe.skip;

/* eslint-disable @typescript-eslint/no-explicit-any */
type Any = any;

/** The result shape of INTERFACE.md, loosely typed: the ops are not typed yet. */
type Res = {
  success: boolean;
  dryRun: boolean;
  error?: string;
  notAttempted: string[];
  groups: {
    group: string;
    applied: boolean | 'unknown';
    ops: number;
    error?: string;
    warnings: unknown[];
    changes: Any;
  }[];
};

const ZERO = {
  glossaries: { inserted: 0, updated: 0, deleted: 0 },
  glossaryEdges: { inserted: 0, deleted: 0 },
  names: { inserted: 0, updated: 0 },
  annotations: { deleted: 0 },
};

const ENTITY_ID = /^entity-\d+$/;

describeLive('glossary ops in applyWorkEdits against the database', () => {
  let c: LiveClients;
  let db: DataClient;
  let s: Scratch;
  let workA: string;
  let workB: string;

  beforeAll(async () => {
    c = liveClients();
    db = c.db;
    s = new Scratch(db);
    workA = await s.work();
    workB = await s.work();
  });

  afterAll(async () => {
    await s?.cleanup();
    if (s) {
      // Nothing the specs made may outlive them, including ops' authorities.
      expect(await s.leftovers()).toEqual({
        works: 0,
        authorities: 0,
        names: 0,
        glossaries: 0,
        passages: 0,
        creators: 0,
      });
    }
  });

  const run = async (
    ops: unknown[],
    {
      dryRun,
      client = c.editor,
      workUuid = workA,
    }: { dryRun?: boolean; client?: DataClient; workUuid?: string } = {},
  ): Promise<Res> =>
    (await applyWorkEdits({
      client,
      workUuid,
      ops: ops as never,
      dryRun,
    })) as unknown as Res;

  const glossary = (res: Res) => {
    const found = res.groups.find((g) => g.group === 'glossary');
    if (!found) {
      throw new Error(`no glossary group in ${JSON.stringify(res)}`);
    }
    return found;
  };

  const read = async (workUuid: string, uuid: string) => {
    const result = await getGlossaryEntry({ client: db, workUuid, uuid });
    if (result.status !== 'found') {
      throw new Error(`${uuid} read as ${result.status}`);
    }
    return result.entry;
  };

  const exists = async (workUuid: string, uuid: string) =>
    (await getGlossaryEntry({ client: db, workUuid, uuid })).status === 'found';

  const authorityRows = (uuids: string[]) =>
    select(db, 'authorities', 'uuid', uuids);

  const nameRow = async (uuid: string) =>
    (await select(db, 'names', 'uuid', [uuid]))[0];

  /** All glossaries rows (root and names) of the entry rooted at `root`. */
  const entryRows = async (root: string): Promise<Row[]> => {
    const edges = await select(db, 'glossary_edges', 'parent_uuid', [root]);
    return select(
      db,
      'glossaries',
      'uuid',
      edges.map((e) => e['child_uuid'] as string),
    );
  };

  /** Refused as a whole: reported, with the group not applied. */
  const expectRefused = (res: Res, ...mentions: string[]) => {
    expect(res.success).toBe(false);
    const g = glossary(res);
    expect(g.applied).toBe(false);
    expect(typeof (g.error ?? res.error)).toBe('string');
    expect(`${g.error ?? ''} ${res.error ?? ''}`).not.toMatch(/unknown op/i);
    for (const text of mentions) {
      expect(`${g.error ?? ''} ${res.error ?? ''}`).toContain(text);
    }
  };

  /**
   * Rejected as a whole, wherever the refusal is reported: at the top level
   * (before any group is planned) or by the glossary group, which then did
   * not apply.
   */
  const expectRejected = (res: Res) => {
    expect(res.success).toBe(false);
    const g = res.groups.find((x) => x.group === 'glossary');
    if (g) expect(g.applied).toBe(false);
    expect(typeof (g?.error ?? res.error)).toBe('string');
    // Refused for what is wrong with it, not for being an op nobody knows.
    expect(`${g?.error ?? ''} ${res.error ?? ''}`).not.toMatch(/unknown op/i);
  };

  /**
   * An entry of `workUuid` written straight into the tables: a root name and
   * any other names, each with its glossaries row and edge.
   */
  const makeEntry = async (args: {
    workUuid: string;
    authorityUuid: string;
    root: { language: string; content: string; nameUuid?: string };
    others?: {
      language: string;
      content: string;
      nameUuid?: string;
      termType?: string;
      attestation?: string;
      contentTransformed?: string;
    }[];
    definition?: string | null;
    definitionRend?: string | null;
    glossMode?: string | null;
  }) => {
    const rootName =
      args.root.nameUuid ??
      (await s.name({ authorityUuid: args.authorityUuid, ...args.root }));
    const uuid = await s.row({
      workUuid: args.workUuid,
      authorityUuid: args.authorityUuid,
      nameUuid: rootName,
      termType: 'translationMain',
      definition: args.definition,
      definitionRend: args.definitionRend,
      glossMode: args.glossMode,
    });
    const others: { glossaryUuid: string; nameUuid: string }[] = [];
    for (const o of args.others ?? []) {
      const nameUuid =
        o.nameUuid ??
        (await s.name({ authorityUuid: args.authorityUuid, ...o }));
      const glossaryUuid = await s.row({
        workUuid: args.workUuid,
        authorityUuid: args.authorityUuid,
        nameUuid,
        rootUuid: uuid,
        termType: o.termType ?? 'translationAlternative',
        attestation: o.attestation,
      });
      others.push({ glossaryUuid, nameUuid });
    }
    return { uuid, rootName, others };
  };

  /** An upsert of a new entry with a new authority, and its pieces. */
  const newEntryOp = (what: string) => {
    const authorityUuid = s.track(uid());
    const entryUuid = uid();
    const headword = s.label(`${what} headword`);
    return {
      authorityUuid,
      entryUuid,
      headword,
      op: {
        op: 'upsert-glossary-entry',
        entry: {
          uuid: entryUuid,
          authority: {
            new: {
              uuid: authorityUuid,
              headword,
              headwordLanguage: 'Sa-Ltn',
              definition: 'The new standard definition.',
            },
          },
          definition: 'The entry definition.',
          definitionRend: 'incompatibleWithStandard',
          glossMode: 'marked',
          names: [
            {
              language: 'en',
              content: s.label(`${what} root`),
              termType: 'translationMain',
            },
            {
              language: 'Bo-Ltn',
              content: s.label(`${what} wylie`),
              contentTransformed: 'ཏེསྟ',
              termType: 'translationMain',
              attestation: 'attestedSource',
            },
            {
              language: 'en',
              content: s.label(`${what} alternative`),
              termType: 'translationAlternative',
            },
          ],
        },
      } as Any,
    };
  };

  it('puts the glossary group last in the commit order', () => {
    expect([...WORK_EDIT_GROUPS]).toEqual([
      'work-metadata',
      'passages',
      'glossary',
    ]);
  });

  describe('AC1: an entry with names and a new authority', () => {
    it('dry-runs it, applies it, and reads the entry back', async () => {
      const n = newEntryOp('ac1');
      const before = await s.snapshot();

      // Dry run: reported, nothing written.
      const dry = await run([n.op], { dryRun: true });
      expect(dry).toMatchObject({ success: true, dryRun: true });
      expect(dry.groups.map((g) => g.group)).toEqual(['glossary']);
      const dg = glossary(dry);
      expect(dg.applied).toBe(false);
      expect(dg.changes.group).toBe('glossary');
      expect(dg.changes.authorities).toEqual([
        {
          uuid: n.authorityUuid,
          headword: n.headword,
          headwordLanguage: 'Sa-Ltn',
          definition: 'The new standard definition.',
          xmlId: null,
        },
      ]);
      expect(dg.changes.entries).toHaveLength(1);
      expect(dg.changes.entries[0]).toMatchObject({
        uuid: n.entryUuid,
        action: 'create',
        before: null,
        copiedNames: [],
        movedNames: [],
      });
      const planned = dg.changes.entries[0].after;
      expect(planned).toMatchObject({
        uuid: n.entryUuid,
        workUuid: workA,
        authorityUuid: n.authorityUuid,
        definition: 'The entry definition.',
        definitionRend: 'incompatibleWithStandard',
        glossMode: 'marked',
      });
      expect(planned.names[0]).toMatchObject({
        language: 'en',
        content: s.label('ac1 root'),
      });
      expect(planned.names.map((x: Any) => x.content).sort()).toEqual(
        [
          s.label('ac1 root'),
          s.label('ac1 wylie'),
          s.label('ac1 alternative'),
        ].sort(),
      );
      expect(await s.snapshot()).toEqual(before);
      expect(await authorityRows([n.authorityUuid])).toEqual([]);
      expect(await exists(workA, n.entryUuid)).toBe(false);

      // Apply.
      const applied = await run([n.op]);
      expect(applied).toMatchObject({ success: true, dryRun: false });
      const ag = glossary(applied);
      expect(ag.applied).toBe(true);
      expect(ag.changes.entries[0]).toMatchObject({
        uuid: n.entryUuid,
        action: 'create',
        before: null,
      });
      expect(ag.changes.rows).toEqual({
        glossaries: { inserted: 3, updated: 0, deleted: 0 },
        glossaryEdges: { inserted: 3, deleted: 0 },
        names: { inserted: 3, updated: 0 },
        annotations: { deleted: 0 },
      });

      const [report] = ag.changes.authorities;
      expect(report).toMatchObject({
        uuid: n.authorityUuid,
        headword: n.headword,
        headwordLanguage: 'Sa-Ltn',
        definition: 'The new standard definition.',
      });
      expect(report.xmlId).toMatch(ENTITY_ID);

      // The authority and entry are stored.
      const [authority] = await authorityRows([n.authorityUuid]);
      expect(authority).toMatchObject({
        uuid: n.authorityUuid,
        xmlId: report.xmlId,
        headword: n.headword,
        headword_language: 'Sa-Ltn',
        definition: 'The new standard definition.',
      });
      const sameXmlId = await select(db, 'authorities', 'xmlId', [
        report.xmlId,
      ]);
      expect(sameXmlId).toHaveLength(1);

      const stored = await read(workA, n.entryUuid);
      expect(stored).toMatchObject({
        uuid: n.entryUuid,
        workUuid: workA,
        authorityUuid: n.authorityUuid,
        definition: 'The entry definition.',
        definitionRend: 'incompatibleWithStandard',
        glossMode: 'marked',
      });
      expect(stored.names).toHaveLength(3);
      expect(stored.names[0]).toMatchObject({
        language: 'en',
        content: s.label('ac1 root'),
      });
      expect(
        stored.names.every((x) => x.nameAuthorityUuid === n.authorityUuid),
      ).toBe(true);
      expect(stored.names.find((x) => x.language === 'Bo-Ltn')).toMatchObject({
        content: s.label('ac1 wylie'),
        contentTransformed: 'ཏེསྟ',
        attestation: 'attestedSource',
      });
      expect(ag.changes.entries[0].after).toEqual(stored);
    });
  });

  describe('AC2: a stale expect is refused and writes nothing', () => {
    let authority: string;
    let entry: Awaited<ReturnType<typeof makeEntry>>;

    beforeAll(async () => {
      authority = await s.authority();
      entry = await makeEntry({
        workUuid: workA,
        authorityUuid: authority,
        root: { language: 'en', content: s.label('ac2 root') },
        others: [
          { language: 'Bo-Ltn', content: s.label('ac2 wylie') },
          { language: 'en', content: s.label('ac2 alternative') },
        ],
        definition: 'Original.',
      });
    });

    const patch = (
      set: Record<string, unknown>,
      expectValues: Record<string, unknown>,
    ) => ({
      op: 'patch-glossary-entry',
      uuid: entry.uuid,
      set,
      expect: expectValues,
    });

    it.each([false, true])(
      'refuses a stale definition, naming the field, expected and stored values (dryRun %s)',
      async (dryRun) => {
        const before = await s.snapshot();
        const res = await run(
          [
            patch(
              { definition: 'Replacement.' },
              { definition: 'A stale definition.' },
            ),
          ],
          { dryRun },
        );
        expectRefused(res, 'definition', 'A stale definition.', 'Original.');
        expect(await s.snapshot()).toEqual(before);
      },
    );

    it('writes nothing from the rest of the call when one op is stale', async () => {
      const n = newEntryOp('ac2 mixed');
      const before = await s.snapshot();
      const res = await run([
        n.op,
        patch({ definition: 'Replacement.' }, { definition: 'Stale.' }),
      ]);
      expectRefused(res, 'definition');
      expect(await s.snapshot()).toEqual(before);
      expect(await authorityRows([n.authorityUuid])).toEqual([]);
      expect(await exists(workA, n.entryUuid)).toBe(false);
    });

    it('refuses a stale expect on glossMode and on definitionRend', async () => {
      const before = await s.snapshot();
      const res = await run([
        patch({ glossMode: 'marked' }, { glossMode: 'marked' }),
      ]);
      // An unset mode reads as 'match', so expecting 'marked' is stale.
      expectRefused(res, 'glossMode');
      const res2 = await run([
        patch(
          { definitionRend: 'overrideWithStandard' },
          { definitionRend: 'appendWithStandard' },
        ),
      ]);
      expectRefused(res2, 'definitionRend');
      expect(await s.snapshot()).toEqual(before);
    });

    it('refuses a stale expect on names', async () => {
      const before = await s.snapshot();
      const res = await run([
        patch(
          { names: [{ language: 'en', content: s.label('ac2 renamed') }] },
          { names: [{ language: 'en', content: s.label('ac2 not the root') }] },
        ),
      ]);
      expectRefused(res, 'names');
      expect(await s.snapshot()).toEqual(before);
    });

    it('refuses a key of set that has no expect value', async () => {
      const before = await s.snapshot();
      const res = await run([
        patch(
          { definition: 'Replacement.', glossMode: 'marked' },
          { definition: 'Original.' },
        ),
      ]);
      expectRejected(res);
      expect(await s.snapshot()).toEqual(before);
    });

    it('refuses an upsert of the stored entry whose expect is stale', async () => {
      const before = await s.snapshot();
      const res = await run([
        {
          op: 'upsert-glossary-entry',
          entry: {
            uuid: entry.uuid,
            authority,
            definition: 'Overwritten.',
            names: [{ language: 'en', content: s.label('ac2 root') }],
          },
          expect: { definition: 'A stale definition.' },
        },
      ]);
      expectRefused(res, 'definition');
      expect(await s.snapshot()).toEqual(before);
    });

    it('applies a patch whose expect matches the stored value', async () => {
      const res = await run([
        patch(
          { definition: 'Patched.', glossMode: 'marked' },
          { definition: 'Original.', glossMode: 'match' },
        ),
      ]);
      expect(res.success).toBe(true);
      expect(glossary(res).applied).toBe(true);
      expect(glossary(res).changes.entries[0]).toMatchObject({
        uuid: entry.uuid,
        action: 'update',
      });
      expect(await read(workA, entry.uuid)).toMatchObject({
        definition: 'Patched.',
        glossMode: 'marked',
        authorityUuid: authority,
      });
      expect((await read(workA, entry.uuid)).names).toHaveLength(3);
    });
  });

  describe('AC3: renaming an entry whose names row another work shares', () => {
    const world = async (what: string) => {
      const authority = await s.authority();
      const shared = await s.name({
        authorityUuid: authority,
        language: 'en',
        content: s.label(`${what} shared`),
      });
      const mine = await makeEntry({
        workUuid: workA,
        authorityUuid: authority,
        root: {
          language: 'en',
          content: s.label(`${what} shared`),
          nameUuid: shared,
        },
        definition: 'Entry in work A.',
      });
      const theirs = await makeEntry({
        workUuid: workB,
        authorityUuid: authority,
        root: {
          language: 'en',
          content: s.label(`${what} shared`),
          nameUuid: shared,
        },
        definition: 'Entry in work B.',
      });
      return { authority, shared, mine, theirs, what };
    };

    const expectCopied = async (
      w: Awaited<ReturnType<typeof world>>,
      theirsBefore: Awaited<ReturnType<typeof read>>,
      res: Res,
    ) => {
      expect(res.success).toBe(true);
      // The other work's entry and the shared names row are untouched.
      expect(await read(workB, w.theirs.uuid)).toEqual(theirsBefore);
      expect(await nameRow(w.shared)).toMatchObject({
        uuid: w.shared,
        authority_uuid: w.authority,
        language: 'en',
        content: s.label(`${w.what} shared`),
      });
      // This work's entry has the new name, in a names row of its own.
      const mine = await read(workA, w.mine.uuid);
      expect(mine.definition).toBe('Entry in work A.');
      expect(mine.names).toHaveLength(1);
      expect(mine.names[0]).toMatchObject({
        language: 'en',
        content: s.label(`${w.what} renamed`),
        nameAuthorityUuid: w.authority,
      });
      expect(mine.names[0].nameUuid).not.toBe(w.shared);
      const reported = glossary(res).changes.entries[0];
      expect(reported.copiedNames).toHaveLength(1);
      expect(reported.copiedNames[0]).toMatchObject({ language: 'en' });
    };

    it('patch: leaves the other work’s entry unchanged', async () => {
      const w = await world('ac3 patch');
      const theirsBefore = await read(workB, w.theirs.uuid);
      const res = await run([
        {
          op: 'patch-glossary-entry',
          uuid: w.mine.uuid,
          set: {
            names: [
              {
                glossaryUuid: w.mine.uuid,
                language: 'en',
                content: s.label('ac3 patch renamed'),
              },
            ],
          },
          expect: {
            names: [{ language: 'en', content: s.label('ac3 patch shared') }],
          },
        },
      ]);
      await expectCopied(w, theirsBefore, res);
    });

    it('upsert: leaves the other work’s entry unchanged', async () => {
      const w = await world('ac3 upsert');
      const theirsBefore = await read(workB, w.theirs.uuid);
      const res = await run([
        {
          op: 'upsert-glossary-entry',
          entry: {
            uuid: w.mine.uuid,
            authority: w.authority,
            names: [{ language: 'en', content: s.label('ac3 upsert renamed') }],
          },
        },
      ]);
      await expectCopied(w, theirsBefore, res);
    });

    it('a dry run reports the copy and writes nothing', async () => {
      const w = await world('ac3 dry');
      const before = await s.snapshot();
      const res = await run(
        [
          {
            op: 'patch-glossary-entry',
            uuid: w.mine.uuid,
            set: {
              names: [{ language: 'en', content: s.label('ac3 dry renamed') }],
            },
            expect: {
              names: [{ language: 'en', content: s.label('ac3 dry shared') }],
            },
          },
        ],
        { dryRun: true },
      );
      expect(res.success).toBe(true);
      expect(glossary(res).changes.entries[0].copiedNames).toHaveLength(1);
      expect(await s.snapshot()).toEqual(before);
    });

    it('edits an unshared name in place', async () => {
      const authority = await s.authority();
      const mine = await makeEntry({
        workUuid: workA,
        authorityUuid: authority,
        root: { language: 'en', content: s.label('ac3 own') },
      });
      const res = await run([
        {
          op: 'patch-glossary-entry',
          uuid: mine.uuid,
          set: {
            names: [{ language: 'en', content: s.label('ac3 own edited') }],
          },
          expect: { names: [{ language: 'en', content: s.label('ac3 own') }] },
        },
      ]);
      expect(res.success).toBe(true);
      expect(glossary(res).changes.entries[0].copiedNames).toEqual([]);
      expect(await nameRow(mine.rootName)).toMatchObject({
        content: s.label('ac3 own edited'),
      });
      expect((await read(workA, mine.uuid)).names[0].nameUuid).toBe(
        mine.rootName,
      );
    });
  });

  describe('AC4: a new authority without editor.edit', () => {
    const accounts: [string, () => DataClient][] = [
      [
        'an authenticated account whose role lacks editor.edit',
        () => c.manager,
      ],
      ['anon', () => c.anon],
    ];

    it.each(accounts)(
      'is refused by the database for %s, writing neither row',
      async (_name, client) => {
        const n = newEntryOp('ac4');
        const before = await s.snapshot();
        const res = await run([n.op], { client: client() });
        expectRefused(res);
        expect(res.groups).toHaveLength(1);
        expect(await authorityRows([n.authorityUuid])).toEqual([]);
        expect(await exists(workA, n.entryUuid)).toBe(false);
        const after = await s.snapshot();
        expect(after).toEqual(before);
        // Even the derived-uuid form leaves no authority behind.
        const derived = newEntryOp('ac4 derived');
        delete derived.op.entry.uuid;
        delete derived.op.entry.authority.new.uuid;
        const res2 = await run([derived.op], { client: client() });
        expectRefused(res2);
        expect(await s.snapshot()).toEqual(before);
      },
    );

    it('refuses an op on an existing authority for an account without editor.edit', async () => {
      const authority = await s.authority();
      const e = await makeEntry({
        workUuid: workA,
        authorityUuid: authority,
        root: { language: 'en', content: s.label('ac4 stored') },
        definition: 'Stored.',
      });
      const before = await s.snapshot();
      const res = await run(
        [
          {
            op: 'patch-glossary-entry',
            uuid: e.uuid,
            set: { definition: 'Vandalised.' },
            expect: { definition: 'Stored.' },
          },
        ],
        { client: c.manager },
      );
      expectRefused(res);
      expect(await s.snapshot()).toEqual(before);
    });

    it('lets an account with editor.edit create the same entry', async () => {
      const n = newEntryOp('ac4 editor');
      const res = await run([n.op], { client: c.editor });
      expect(res.success).toBe(true);
      expect(await authorityRows([n.authorityUuid])).toHaveLength(1);
      expect(await exists(workA, n.entryUuid)).toBe(true);
    });
  });

  describe('upsert-glossary-entry', () => {
    it('re-running with derived uuids writes nothing, and updates in place', async () => {
      const headword = s.label('derived headword');
      const op = (definition?: string) => ({
        op: 'upsert-glossary-entry',
        entry: {
          authority: {
            new: { headword, headwordLanguage: 'Sa-Ltn', definition: 'Std.' },
          },
          ...(definition ? { definition } : {}),
          names: [
            { language: 'en', content: s.label('derived root') },
            {
              language: 'Bo-Ltn',
              content: s.label('derived wylie'),
              contentTransformed: 'ཏེསྟ',
              attestation: 'attestedDictionary',
            },
          ],
        },
      });
      const taggedAuthorities = async () => {
        const { data, error } = await db
          .from('authorities')
          .select('uuid')
          .eq('headword', headword);
        if (error) throw new Error(error.message);
        return data ?? [];
      };

      const first = await run([op('First.')]);
      expect(first.success).toBe(true);
      const created = glossary(first).changes;
      expect(created.entries[0].action).toBe('create');
      const entryUuid = created.entries[0].uuid;
      const authorityUuid = s.track(created.authorities[0].uuid);
      expect(entryUuid).toMatch(/^[0-9a-f-]{36}$/);
      expect(await taggedAuthorities()).toHaveLength(1);

      const stored = await s.snapshot();
      const again = await run([op('First.')]);
      expect(again.success).toBe(true);
      const ag = glossary(again).changes;
      expect(ag.entries).toHaveLength(1);
      expect(ag.entries[0]).toMatchObject({
        uuid: entryUuid,
        action: 'unchanged',
      });
      expect(ag.authorities).toEqual([]);
      expect(ag.rows).toEqual(ZERO);
      expect(await s.snapshot()).toEqual(stored);

      const dry = await run([op('First.')], { dryRun: true });
      expect(glossary(dry).changes.entries[0].action).toBe('unchanged');
      expect(glossary(dry).changes.authorities).toEqual([]);

      // A changed definition updates the same entry; no second authority.
      const changed = await run([op('Second.')]);
      expect(changed.success).toBe(true);
      expect(glossary(changed).changes.entries[0]).toMatchObject({
        uuid: entryUuid,
        action: 'update',
      });
      expect(glossary(changed).changes.authorities).toEqual([]);
      expect(await read(workA, entryUuid)).toMatchObject({
        definition: 'Second.',
        authorityUuid,
      });
      expect(await taggedAuthorities()).toHaveLength(1);
    });

    it('leaves an omitted definition, definitionRend and glossMode as stored', async () => {
      const authority = await s.authority();
      const e = await makeEntry({
        workUuid: workA,
        authorityUuid: authority,
        root: { language: 'en', content: s.label('omit root') },
        definition: 'Kept.',
        definitionRend: 'overrideWithStandard',
        glossMode: 'marked',
      });
      const res = await run([
        {
          op: 'upsert-glossary-entry',
          entry: {
            uuid: e.uuid,
            authority,
            names: [{ language: 'en', content: s.label('omit root') }],
          },
        },
      ]);
      expect(res.success).toBe(true);
      expect(glossary(res).changes.entries[0].action).toBe('unchanged');
      expect(await read(workA, e.uuid)).toMatchObject({
        definition: 'Kept.',
        definitionRend: 'overrideWithStandard',
        glossMode: 'marked',
      });
    });

    it('links to an existing authority when one has the new authority’s uuid', async () => {
      const authority = await s.authority();
      const before = (await authorityRows([authority]))[0];
      const res = await run([
        {
          op: 'upsert-glossary-entry',
          entry: {
            uuid: uid(),
            authority: {
              new: {
                uuid: authority,
                headword: s.label('ignored headword'),
                headwordLanguage: 'en',
              },
            },
            names: [{ language: 'en', content: s.label('existing root') }],
          },
        },
      ]);
      expect(res.success).toBe(true);
      expect(glossary(res).changes.authorities).toEqual([]);
      expect((await authorityRows([authority]))[0]).toEqual(before);
      const uuid = glossary(res).changes.entries[0].uuid;
      expect((await read(workA, uuid)).authorityUuid).toBe(authority);
    });

    it('lets two entries share one new authority, and gives separate new authorities different entity ids', async () => {
      const x = newEntryOp('share x');
      const z = newEntryOp('share z');
      const y = {
        op: 'upsert-glossary-entry',
        entry: {
          uuid: uid(),
          authority: x.authorityUuid,
          names: [{ language: 'en', content: s.label('share y root') }],
        },
      };
      const ops = [x.op, y, z.op];

      const dry = await run(ops, { dryRun: true });
      expect(dry.success).toBe(true);
      const planned = glossary(dry).changes.authorities;
      expect(planned.map((a: Any) => a.uuid).sort()).toEqual(
        [x.authorityUuid, z.authorityUuid].sort(),
      );
      expect(planned.every((a: Any) => a.xmlId === null)).toBe(true);

      const res = await run(ops);
      expect(res.success).toBe(true);
      const created = glossary(res).changes.authorities;
      expect(created).toHaveLength(2);
      const ids = created.map((a: Any) => a.xmlId);
      expect(ids.every((id: string) => ENTITY_ID.test(id))).toBe(true);
      expect(new Set(ids).size).toBe(2);

      expect(
        await authorityRows([x.authorityUuid, z.authorityUuid]),
      ).toHaveLength(2);
      expect((await read(workA, x.entryUuid)).authorityUuid).toBe(
        x.authorityUuid,
      );
      const yUuid = glossary(res).changes.entries[1].uuid;
      expect((await read(workA, yUuid)).authorityUuid).toBe(x.authorityUuid);
      expect((await read(workA, z.entryUuid)).authorityUuid).toBe(
        z.authorityUuid,
      );
    });

    it('refuses naming one entry in two glossary ops, writing nothing', async () => {
      const authority = await s.authority();
      const e = await makeEntry({
        workUuid: workA,
        authorityUuid: authority,
        root: { language: 'en', content: s.label('twice root') },
        definition: 'Once.',
      });
      const before = await s.snapshot();
      const res = await run([
        {
          op: 'patch-glossary-entry',
          uuid: e.uuid,
          set: { definition: 'Twice.' },
          expect: { definition: 'Once.' },
        },
        {
          op: 'patch-glossary-entry',
          uuid: e.uuid,
          set: { definition: 'Thrice.' },
          expect: { definition: 'Once.' },
        },
      ]);
      expectRejected(res);
      expect(await s.snapshot()).toEqual(before);
    });
  });

  describe('the fixed values', () => {
    it('accepts every attestation, term type, definition rend and gloss mode', async () => {
      const authority = await s.authority();
      const attestations = [
        'attestedApproximate',
        'attestedDictionary',
        'attestedOther',
        'attestedSource',
        'reconstructedPhonetic',
        'reconstructedSemantic',
        'sourceUnspecified',
      ];
      const rends = [
        'appendWithStandard',
        'incompatibleWithStandard',
        'overrideWithStandard',
        'prependWithStandard',
      ];
      const entries = rends.map((definitionRend, i) => ({
        uuid: uid(),
        authority,
        definition: 'Defined.',
        definitionRend,
        glossMode: i % 2 ? 'marked' : 'match',
        names: [
          {
            language: 'en',
            content: s.label(`fixed ${i} root`),
            termType: 'translationMain',
          },
          ...(i === 0
            ? attestations.map((attestation) => ({
                language: 'Sa-Ltn',
                content: s.label(`fixed ${attestation}`),
                termType: 'translationAlternative',
                attestation,
              }))
            : []),
        ],
      }));
      const res = await run(
        entries.map((entry) => ({ op: 'upsert-glossary-entry', entry })),
      );
      expect(res.success).toBe(true);
      for (const e of entries) {
        const stored = await read(workA, e.uuid);
        expect(stored).toMatchObject({
          definitionRend: e.definitionRend,
          glossMode: e.glossMode,
        });
      }
      const first = await read(workA, entries[0].uuid);
      expect(
        first.names
          .map((x) => x.attestation)
          .filter(Boolean)
          .sort(),
      ).toEqual([...attestations].sort());
    });

    const badEntry = (n: ReturnType<typeof newEntryOp>, bad: string) => {
      const entry = JSON.parse(JSON.stringify(n.op.entry));
      if (bad === 'attestation') entry.names[1].attestation = 'bogus';
      if (bad === 'termType') entry.names[2].termType = 'bogus';
      if (bad === 'definitionRend') entry.definitionRend = 'bogus';
      if (bad === 'glossMode') entry.glossMode = 'bogus';
      return { op: 'upsert-glossary-entry', entry };
    };

    it.each(['attestation', 'termType', 'definitionRend', 'glossMode'])(
      'refuses a %s outside the set, writing nothing',
      async (bad) => {
        const n = newEntryOp(`bad ${bad}`);
        const before = await s.snapshot();
        const res = await run([badEntry(n, bad)]);
        expectRejected(res);
        expect(await s.snapshot()).toEqual(before);
        expect(await authorityRows([n.authorityUuid])).toEqual([]);
        expect(await exists(workA, n.entryUuid)).toBe(false);
      },
    );

    it('refuses a patch that sets a value outside the set', async () => {
      const authority = await s.authority();
      const e = await makeEntry({
        workUuid: workA,
        authorityUuid: authority,
        root: { language: 'en', content: s.label('bad patch root') },
        definitionRend: 'overrideWithStandard',
      });
      const before = await s.snapshot();
      const res = await run([
        {
          op: 'patch-glossary-entry',
          uuid: e.uuid,
          set: { definitionRend: 'bogus' },
          expect: { definitionRend: 'overrideWithStandard' },
        },
      ]);
      expectRejected(res);
      expect(await s.snapshot()).toEqual(before);
    });
  });

  describe('relink-glossary-entry', () => {
    const world = async (what: string) => {
      const from = await s.authority();
      const to = await s.authority();
      // The entry: an own root name, a name another work's entry also uses,
      // and a name a creator also uses.
      const sharedWithEntry = await s.name({
        authorityUuid: from,
        language: 'en',
        content: s.label(`${what} shared with entry`),
      });
      const sharedWithCreator = await s.name({
        authorityUuid: from,
        language: 'Sa-Ltn',
        content: s.label(`${what} shared with creator`),
      });
      const mine = await makeEntry({
        workUuid: workA,
        authorityUuid: from,
        root: { language: 'en', content: s.label(`${what} own root`) },
        others: [
          { language: 'en', content: 'x', nameUuid: sharedWithEntry },
          { language: 'Sa-Ltn', content: 'x', nameUuid: sharedWithCreator },
        ],
      });
      const theirs = await makeEntry({
        workUuid: workB,
        authorityUuid: from,
        root: { language: 'en', content: 'x', nameUuid: sharedWithEntry },
      });
      await s.creator({
        workUuid: workA,
        authorityUuid: from,
        nameUuid: sharedWithCreator,
      });
      return {
        from,
        to,
        mine,
        theirs,
        sharedWithEntry,
        sharedWithCreator,
        what,
      };
    };

    const relink = (w: Awaited<ReturnType<typeof world>>, o = {}) => ({
      op: 'relink-glossary-entry',
      uuid: w.mine.uuid,
      authority: w.to,
      expect: { authority: w.from },
      ...o,
    });

    it('moves the names only this entry uses, and copies the shared ones', async () => {
      const w = await world('relink');
      const theirsBefore = await read(workB, w.theirs.uuid);
      const before = await s.snapshot();

      const dry = await run([relink(w)], { dryRun: true });
      expect(dry.success).toBe(true);
      const planned = glossary(dry).changes.entries[0];
      expect(planned.action).toBe('update');
      expect(planned.movedNames.map((x: Any) => x.nameUuid)).toEqual([
        w.mine.rootName,
      ]);
      expect(planned.copiedNames.map((x: Any) => x.content).sort()).toEqual(
        [
          s.label('relink shared with creator'),
          s.label('relink shared with entry'),
        ].sort(),
      );
      expect(await s.snapshot()).toEqual(before);

      const res = await run([relink(w)]);
      expect(res.success).toBe(true);
      const report = glossary(res).changes.entries[0];
      expect(report.movedNames.map((x: Any) => x.nameUuid)).toEqual([
        w.mine.rootName,
      ]);
      expect(report.copiedNames).toHaveLength(2);

      // The entry, every row of it, is on the new authority.
      const entry = await read(workA, w.mine.uuid);
      expect(entry.authorityUuid).toBe(w.to);
      expect(entry.names).toHaveLength(3);
      expect(entry.names.every((x) => x.nameAuthorityUuid === w.to)).toBe(true);
      expect(
        (await entryRows(w.mine.uuid)).every(
          (r) => r['authority_uuid'] === w.to,
        ),
      ).toBe(true);
      // The own name moved: same row, new authority.
      expect(await nameRow(w.mine.rootName)).toMatchObject({
        authority_uuid: w.to,
      });
      expect(entry.names[0].nameUuid).toBe(w.mine.rootName);
      // The shared names stayed where they were; the entry uses copies.
      for (const shared of [w.sharedWithEntry, w.sharedWithCreator]) {
        expect(await nameRow(shared)).toMatchObject({
          authority_uuid: w.from,
        });
        expect(entry.names.map((x) => x.nameUuid)).not.toContain(shared);
      }
      expect(entry.names.map((x) => x.content).sort()).toEqual(
        [
          s.label('relink own root'),
          s.label('relink shared with creator'),
          s.label('relink shared with entry'),
        ].sort(),
      );
      // The other work's entry is untouched.
      expect(await read(workB, w.theirs.uuid)).toEqual(theirsBefore);
    });

    it('is refused when expect.authority is stale, writing nothing', async () => {
      const w = await world('relink stale');
      const before = await s.snapshot();
      const res = await run([relink(w, { expect: { authority: w.to } })]);
      expectRefused(res, 'authority');
      expect(await s.snapshot()).toEqual(before);
    });

    it('is refused when the authority does not exist, writing nothing', async () => {
      const w = await world('relink missing');
      const before = await s.snapshot();
      const res = await run([relink(w, { authority: uid() })]);
      expectRejected(res);
      expect(await s.snapshot()).toEqual(before);
    });
  });

  describe('delete-glossary-entry', () => {
    it('removes the entry and this work’s glossary-instance annotations citing it', async () => {
      const authority = await s.authority();
      const doomed = await makeEntry({
        workUuid: workA,
        authorityUuid: authority,
        root: { language: 'en', content: s.label('del root') },
        others: [{ language: 'Bo-Ltn', content: s.label('del wylie') }],
        definition: 'Doomed.',
      });
      const kept = await makeEntry({
        workUuid: workA,
        authorityUuid: authority,
        root: { language: 'en', content: s.label('del other') },
      });
      const pA = await s.passage(workA);
      const pB = await s.passage(workB);
      const removed = [
        await s.annotation(pA, doomed.uuid),
        await s.annotation(pA, doomed.uuid, doomed.others[0].glossaryUuid),
      ];
      const stays = [
        await s.annotation(pA, kept.uuid),
        await s.annotation(pB, doomed.uuid),
      ];
      const stored = await read(workA, doomed.uuid);
      const op = {
        op: 'delete-glossary-entry',
        uuid: doomed.uuid,
        expect: { definition: 'Doomed.' },
      };

      // A stale expect refuses the delete.
      const before = await s.snapshot();
      expectRefused(
        await run([{ ...op, expect: { definition: 'Not this.' } }]),
        'definition',
      );
      expect(await s.snapshot()).toEqual(before);

      const dry = await run([op], { dryRun: true });
      expect(dry.success).toBe(true);
      expect(glossary(dry).changes.entries[0]).toMatchObject({
        uuid: doomed.uuid,
        action: 'delete',
        before: stored,
        after: null,
      });
      expect(glossary(dry).changes.rows.annotations.deleted).toBe(2);
      expect(await s.snapshot()).toEqual(before);

      const res = await run([op]);
      expect(res.success).toBe(true);
      expect(glossary(res).changes.entries[0]).toMatchObject({
        action: 'delete',
        after: null,
      });
      expect(glossary(res).changes.rows).toEqual({
        glossaries: { inserted: 0, updated: 0, deleted: 2 },
        glossaryEdges: { inserted: 0, deleted: 2 },
        names: { inserted: 0, updated: 0 },
        annotations: { deleted: 2 },
      });
      expect(await exists(workA, doomed.uuid)).toBe(false);
      expect(await entryRows(doomed.uuid)).toEqual([]);
      expect(await select(db, 'passage_annotations', 'uuid', removed)).toEqual(
        [],
      );
      expect(
        await select(db, 'passage_annotations', 'uuid', stays),
      ).toHaveLength(2);
      // Names rows and the authority stay.
      expect(await nameRow(doomed.rootName)).toBeDefined();
      expect(await nameRow(doomed.others[0].nameUuid)).toBeDefined();
      expect(await authorityRows([authority])).toHaveLength(1);
      expect(await exists(workA, kept.uuid)).toBe(true);
    });

    it.each([
      [
        'patch',
        (uuid: string) => ({
          op: 'patch-glossary-entry',
          uuid,
          set: { definition: 'x' },
          expect: { definition: null },
        }),
      ],
      [
        'relink',
        (uuid: string) => ({
          op: 'relink-glossary-entry',
          uuid,
          authority: uid(),
          expect: { authority: uid() },
        }),
      ],
      ['delete', (uuid: string) => ({ op: 'delete-glossary-entry', uuid })],
    ])(
      'refuses a %s of a uuid that is not an entry of the work, writing nothing',
      async (_name, make) => {
        const authority = await s.authority();
        const theirs = await makeEntry({
          workUuid: workB,
          authorityUuid: authority,
          root: { language: 'en', content: s.label(`foreign ${_name}`) },
        });
        const before = await s.snapshot();
        // Neither a random uuid nor an entry of another work.
        expectRejected(await run([make(uid())]));
        expectRejected(await run([make(theirs.uuid)]));
        // A valid op in the same call is not written either.
        const n = newEntryOp(`foreign ${_name}`);
        expectRejected(await run([n.op, make(uid())]));
        expect(await s.snapshot()).toEqual(before);
        expect(await authorityRows([n.authorityUuid])).toEqual([]);
        expect(await exists(workB, theirs.uuid)).toBe(true);
      },
    );
  });
});
