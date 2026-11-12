/**
 * @jest-environment node
 */
// The glossary group of `applyWorkEdits` against a local Supabase: what the
// database does with a whole call (atomicity, shared names rows, the
// authorities insert policy, entity-N numbering, re-runs).
//
// Skipped unless DATA_ACCESS_LIVE=1. Needs SUPABASE_URL (local),
// SUPABASE_SERVICE_ROLE_KEY, SUPABASE_ANON_KEY and SUPABASE_JWT_SECRET.
import { getGlossaryEntry } from '../glossary/entry/read';
import type { DataClient } from '../types';
import { applyWorkEdits } from './apply-work-edits';
import {
  LIVE,
  Scratch,
  liveClients,
  select,
  uid,
  type LiveClients,
} from './glossary.live.acceptance-fixture';

const describeLive = LIVE ? describe : describe.skip;

/* eslint-disable @typescript-eslint/no-explicit-any */
type Any = any;

/** The result shape, loosely typed so tests can read any group's changes. */
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

  describe('a stale expect', () => {
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
  });

  describe('renaming an entry whose names row another work shares', () => {
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

    it('leaves the other work’s entry unchanged', async () => {
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
  });

  describe('a new authority without editor.edit', () => {
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
  });
});
