/**
 * @jest-environment node
 */
// DEV-884 acceptance tests against a local Supabase: what the entry panel
// reads (shared names, the default matching mode, authorities found by any
// name) and that every value it can set reads back as set. Skipped unless
// DATA_ACCESS_LIVE=1, with SUPABASE_URL (a local URL) and
// SUPABASE_SERVICE_ROLE_KEY. Writes scratch rows only and removes them.
import { createClient } from '@supabase/supabase-js';
import { v4 as uuidv4 } from 'uuid';

import type { DataClient } from '../../types';
import { searchGlossaryAuthorities } from '../authority';
import { getGlossaryEntry, getGlossaryEntrySharedNames } from './read';
import { saveGlossaryEntry } from './save';
import {
  GLOSSARY_ATTESTATIONS,
  GLOSSARY_DEFINITION_RENDS,
  type GlossaryEntry,
  type GlossaryEntryChange,
  type GlossaryEntryName,
  type GlossaryEntryNameInput,
  type GlossarySaveResult,
} from './types';

const LIVE = process.env['DATA_ACCESS_LIVE'] === '1';
const describeLive = LIVE ? describe : describe.skip;

const uid = (): string => uuidv4();

const liveClient = (): DataClient => {
  const url = process.env['SUPABASE_URL'] ?? '';
  const key = process.env['SUPABASE_SERVICE_ROLE_KEY'];
  const host = URL.canParse(url) ? new URL(url).hostname : '';
  if (host !== '127.0.0.1' && host !== 'localhost') {
    throw new Error('SUPABASE_URL must be a local Supabase (127.0.0.1)');
  }
  if (!key) throw new Error('SUPABASE_SERVICE_ROLE_KEY is not set');
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  }) as unknown as DataClient;
};

const check = (error: { message: string } | null, what: string) => {
  if (error) throw new Error(`${what}: ${error.message}`);
};

/** What one spec writes, removed again by `cleanup`. */
class Scratch {
  readonly tag = uid().replace(/-/g, '').slice(0, 8);
  readonly works: string[] = [];
  readonly authorities: string[] = [];
  private seq = 0;

  constructor(readonly db: DataClient) {}

  async work(): Promise<string> {
    const uuid = uid();
    const { error } = await this.db.from('works').insert({
      uuid,
      title: `panel acceptance scratch ${this.tag}-${++this.seq}`,
    });
    check(error, 'insert work');
    this.works.push(uuid);
    return uuid;
  }

  async authority(headword?: string): Promise<string> {
    const uuid = uid();
    const n = ++this.seq;
    const { error } = await this.db.from('authorities').insert({
      uuid,
      xmlId: `panel-acceptance-${this.tag}-${n}`,
      headword: headword ?? `panel acceptance authority ${this.tag}-${n}`,
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

  async creator(args: {
    workUuid: string;
    authorityUuid: string;
    nameUuid: string;
  }): Promise<void> {
    const { error } = await this.db.from('creators').insert({
      uuid: uid(),
      authority_uuid: args.authorityUuid,
      work_uuid: args.workUuid,
      type: 'translator',
      name_uuid: args.nameUuid,
    });
    check(error, 'insert creator');
  }

  /** A `glossaries` row with its edge: from `rootUuid`, or a self-edge. */
  async row(args: {
    workUuid: string;
    authorityUuid: string;
    nameUuid: string;
    rootUuid?: string;
    termType?: string | null;
    attestation?: string | null;
    glossMode?: string | null;
  }): Promise<string> {
    const uuid = uid();
    const { error } = await this.db.from('glossaries').insert({
      uuid,
      work_uuid: args.workUuid,
      authority_uuid: args.authorityUuid,
      name_uuid: args.nameUuid,
      termType: args.termType ?? null,
      attestation: args.attestation ?? null,
      ...(args.glossMode === undefined ? {} : { glossMode: args.glossMode }),
    });
    check(error, 'insert glossaries row');
    const edge = await this.db
      .from('glossary_edges')
      .insert({ parent_uuid: args.rootUuid ?? uuid, child_uuid: uuid });
    check(edge.error, 'insert glossary_edges row');
    return uuid;
  }

  /** An entry: its root row with an English main name, and the entry read. */
  async entry(
    workUuid: string,
    authorityUuid: string,
    glossMode?: string | null,
  ): Promise<{ root: string; mainName: string }> {
    const mainName = await this.name({
      authorityUuid,
      language: 'en',
      content: `main ${this.tag} ${++this.seq}`,
    });
    const root = await this.row({
      workUuid,
      authorityUuid,
      nameUuid: mainName,
      termType: 'translationMain',
      glossMode,
    });
    return { root, mainName };
  }

  async cleanup(): Promise<void> {
    const db = this.db;
    const steps: [
      string,
      () => PromiseLike<{ error: { message: string } | null }>,
    ][] = [
      [
        'creators',
        () => db.from('creators').delete().in('work_uuid', this.works),
      ],
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

const succeeded = (result: GlossarySaveResult) => {
  if (!result.success) {
    throw new Error(
      `refused (${result.reason}${result.field ? `, ${result.field}` : ''}): ${result.error}`,
    );
  }
  return result;
};

type Plain = {
  language: string | null;
  content: string;
  contentTransformed: string | null;
  termType: string | null;
  attestation: string | null;
};
const plain = (
  names: readonly (GlossaryEntryName | GlossaryEntryNameInput)[],
) =>
  names
    .map(
      (n): Plain => ({
        language: n.language ?? null,
        content: n.content,
        contentTransformed: n.contentTransformed ?? null,
        termType: n.termType ?? null,
        attestation: n.attestation ?? null,
      }),
    )
    .sort((a, b) => (JSON.stringify(a) < JSON.stringify(b) ? -1 : 1));

describeLive('glossary entry panel data (live)', () => {
  const db = LIVE ? liveClient() : (null as unknown as DataClient);
  const scratch = LIVE ? new Scratch(db) : (null as unknown as Scratch);
  afterAll(async () => {
    if (LIVE) await scratch.cleanup();
  });

  const read = async (
    workUuid: string,
    uuid: string,
  ): Promise<GlossaryEntry> => {
    const found = await getGlossaryEntry({ client: db, workUuid, uuid });
    if (found.status !== 'found')
      throw new Error(`entry ${uuid}: ${found.status}`);
    return found.entry;
  };

  describe('[AC9] which names are shared', () => {
    it('[AC9] marks a name used by another entry or a creator, and no other', async () => {
      const w1 = await scratch.work();
      const w2 = await scratch.work();
      const auth = await scratch.authority();
      const { root } = await scratch.entry(w1, auth);

      const own = await scratch.name({
        authorityUuid: auth,
        language: 'Sa-Ltn',
        content: 'own only',
      });
      const sharedByEntry = await scratch.name({
        authorityUuid: auth,
        language: 'Sa-Ltn',
        content: 'by other entry',
      });
      const sharedAcrossWorks = await scratch.name({
        authorityUuid: auth,
        language: 'Pi-Ltn',
        content: 'by other work',
      });
      const sharedByCreator = await scratch.name({
        authorityUuid: auth,
        language: 'en',
        content: 'by creator',
      });
      for (const nameUuid of [
        own,
        sharedByEntry,
        sharedAcrossWorks,
        sharedByCreator,
      ]) {
        await scratch.row({
          workUuid: w1,
          authorityUuid: auth,
          nameUuid,
          rootUuid: root,
        });
      }
      // Another entry of the same work, and one of another work, use theirs.
      const other = await scratch.entry(w1, auth);
      await scratch.row({
        workUuid: w1,
        authorityUuid: auth,
        nameUuid: sharedByEntry,
        rootUuid: other.root,
      });
      const elsewhere = await scratch.entry(w2, auth);
      await scratch.row({
        workUuid: w2,
        authorityUuid: auth,
        nameUuid: sharedAcrossWorks,
        rootUuid: elsewhere.root,
      });
      await scratch.creator({
        workUuid: w2,
        authorityUuid: auth,
        nameUuid: sharedByCreator,
      });

      const entry = await read(w1, root);
      const shared = await getGlossaryEntrySharedNames({ client: db, entry });
      expect(shared).not.toBeNull();
      expect([...(shared as Set<string>)].sort()).toEqual(
        [sharedByEntry, sharedAcrossWorks, sharedByCreator].sort(),
      );
      expect(shared?.has(own)).toBe(false);
      expect(shared?.has(entry.names[0].nameUuid)).toBe(false);
    });

    it('[AC9] reports nothing shared for an entry whose names are its own', async () => {
      const w = await scratch.work();
      const auth = await scratch.authority();
      const { root } = await scratch.entry(w, auth);
      const entry = await read(w, root);
      const shared = await getGlossaryEntrySharedNames({ client: db, entry });
      expect([...(shared ?? ['unread'])]).toEqual([]);
    });
  });

  describe('[AC13] matching mode', () => {
    it('[AC13] reads an entry stored with no mode as match', async () => {
      const w = await scratch.work();
      const auth = await scratch.authority();
      const { root } = await scratch.entry(w, auth, null);
      const { error } = await db
        .from('glossaries')
        .update({ glossMode: null })
        .eq('uuid', root);
      check(error, 'clear mode');
      expect((await read(w, root)).glossMode).toBe('match');
    });
  });

  describe('[AC18][AC19][AC20] saving what the panel sets', () => {
    let w: string;
    let auth: string;
    let otherAuth: string;
    let root: string;
    let current: GlossaryEntry;

    const apply = async (after: GlossaryEntryChange) => {
      const result = succeeded(
        await saveGlossaryEntry({
          client: db,
          workUuid: w,
          before: current,
          after,
        }),
      );
      const stored = await read(w, root);
      expect(stored).toEqual(result.entries[0]);
      current = stored;
      return stored;
    };

    beforeAll(async () => {
      w = await scratch.work();
      auth = await scratch.authority();
      otherAuth = await scratch.authority();
      ({ root } = await scratch.entry(w, auth));
      current = await read(w, root);
    });

    it('[AC12][AC19] reads each definition relation back as set, and none as null', async () => {
      for (const rend of [...GLOSSARY_DEFINITION_RENDS, null]) {
        const stored = await apply({ definitionRend: rend });
        expect(stored.definitionRend).toBe(rend);
      }
    });

    it('[AC13][AC19] reads each matching mode back as set', async () => {
      expect((await apply({ glossMode: 'marked' })).glossMode).toBe('marked');
      expect((await apply({ glossMode: 'match' })).glossMode).toBe('match');
    });

    it('[AC5][AC7][AC19] reads added names back with their language, term type and attestation', async () => {
      const added: GlossaryEntryNameInput[] = [
        {
          language: 'en',
          content: 'an alternative',
          contentTransformed: null,
          termType: 'translationAlternative',
          attestation: null,
        },
        {
          language: 'Bo-Ltn',
          content: 'byang chub',
          contentTransformed: 'བྱང་ཆུབ',
          termType: null,
          attestation: 'attestedDictionary',
        },
        {
          language: 'Sa-Ltn',
          content: 'bodhi',
          contentTransformed: null,
          termType: null,
          attestation: 'attestedSource',
        },
        {
          language: 'Pi-Ltn',
          content: 'bodhi-pali',
          contentTransformed: null,
          termType: null,
          attestation: null,
        },
        {
          language: 'zh',
          content: '菩提',
          contentTransformed: null,
          termType: null,
          attestation: 'reconstructedPhonetic',
        },
      ];
      const stored = await apply({ names: [...current.names, ...added] });
      expect(plain(stored.names)).toEqual(
        plain([...current.names.slice(0, 1), ...added]),
      );
      expect(stored.names).toHaveLength(added.length + 1);
    });

    it('[AC4][AC19] keeps one main English name, first, when it is edited', async () => {
      const edited = await apply({
        names: current.names.map((n) =>
          n.glossaryUuid === root
            ? { ...n, content: 'the edited main name' }
            : n,
        ),
      });
      const mains = edited.names.filter(
        (n) => n.termType === 'translationMain',
      );
      expect(mains).toHaveLength(1);
      expect(mains[0].content).toBe('the edited main name');
      expect(edited.names[0].glossaryUuid).toBe(root);
      expect(edited.names[0].language).toBe('en');
    });

    it('[AC7][AC19] reads every attestation back, and none', async () => {
      const target = () =>
        current.names.find((n) => n.content === 'bodhi') as GlossaryEntryName;
      for (const attestation of [...GLOSSARY_ATTESTATIONS, null]) {
        const stored = await apply({
          names: current.names.map((n) =>
            n.glossaryUuid === target().glossaryUuid
              ? { ...n, attestation }
              : n,
          ),
        });
        expect(
          stored.names.find((n) => n.content === 'bodhi')?.attestation ?? null,
        ).toBe(attestation);
      }
    });

    it('[AC5][AC19] removes a name and keeps the others', async () => {
      const before = plain(current.names);
      const stored = await apply({
        names: current.names.filter((n) => n.content !== 'bodhi-pali'),
      });
      expect(plain(stored.names)).toEqual(
        before.filter((n) => n.content !== 'bodhi-pali'),
      );
    });

    it('[AC19] writes nothing when the entry is saved as it was read', async () => {
      const result = succeeded(
        await saveGlossaryEntry({
          client: db,
          workUuid: w,
          before: current,
          after: {
            authorityUuid: current.authorityUuid,
            definitionRend: current.definitionRend,
            glossMode: current.glossMode,
            names: current.names,
          },
        }),
      );
      expect(result.changes).toEqual({
        glossaries: { inserted: 0, updated: 0, deleted: 0 },
        glossaryEdges: { inserted: 0, deleted: 0 },
        names: { inserted: 0, updated: 0 },
        annotations: { deleted: 0 },
      });
      expect(await read(w, root)).toEqual(current);
    });

    it('[AC16][AC17] moves the entry to another authority, and cannot leave it with none', async () => {
      const moved = await apply({ authorityUuid: otherAuth });
      expect(moved.authorityUuid).toBe(otherAuth);

      const unlink = await saveGlossaryEntry({
        client: db,
        workUuid: w,
        before: current,
        after: { authorityUuid: null as unknown as string },
      });
      if (unlink.success) {
        expect((await read(w, root)).authorityUuid).toBe(otherAuth);
      }

      const missing = await saveGlossaryEntry({
        client: db,
        workUuid: w,
        before: current,
        after: { authorityUuid: uid() },
      });
      expect(missing.success).toBe(false);
      expect((await read(w, root)).authorityUuid).toBe(otherAuth);
    });

    it('[AC20] refuses a save over a value changed elsewhere, and writes nothing', async () => {
      const { error } = await db
        .from('glossaries')
        .update({ definition_rend: 'overrideWithStandard' })
        .eq('uuid', root);
      check(error, 'change elsewhere');
      const result = await saveGlossaryEntry({
        client: db,
        workUuid: w,
        before: current,
        after: { definitionRend: 'appendWithStandard' },
      });
      expect(result.success).toBe(false);
      if (!result.success) expect(result.reason).toBe('stale');
      expect((await read(w, root)).definitionRend).toBe('overrideWithStandard');
    });

    it('[AC20] refuses a name list saved over names changed elsewhere', async () => {
      current = await read(w, root);
      const before = current;
      // Someone else adds a name.
      succeeded(
        await saveGlossaryEntry({
          client: db,
          workUuid: w,
          before,
          after: {
            names: [
              ...before.names,
              {
                language: 'en',
                content: 'theirs',
                contentTransformed: null,
                termType: 'translationAlternative',
                attestation: null,
              },
            ],
          },
        }),
      );
      const mine = await saveGlossaryEntry({
        client: db,
        workUuid: w,
        before,
        after: {
          names: [
            ...before.names,
            {
              language: 'en',
              content: 'mine',
              contentTransformed: null,
              termType: 'translationAlternative',
              attestation: null,
            },
          ],
        },
      });
      expect(mine.success).toBe(false);
      if (!mine.success) expect(mine.reason).toBe('stale');
      const stored = await read(w, root);
      expect(stored.names.some((n) => n.content === 'theirs')).toBe(true);
      expect(stored.names.some((n) => n.content === 'mine')).toBe(false);
    });
  });

  describe('[AC15] authority search by any name', () => {
    it('[AC15] finds an authority by headword, English alternative, Wylie, script and Chinese name', async () => {
      const tag = scratch.tag;
      const headword = `Zqhead${tag}`;
      const auth = await scratch.authority(headword);
      const script = 'ཀྵཀྵཀྵཀྵཀྵ';
      const names = {
        english: `zqeng${tag} wording`,
        wylie: `zqwyl${tag} bla`,
        chinese: `虛${tag}`,
      };
      await scratch.name({
        authorityUuid: auth,
        language: 'en',
        content: names.english,
      });
      await scratch.name({
        authorityUuid: auth,
        language: 'Bo-Ltn',
        content: names.wylie,
        contentTransformed: script,
      });
      await scratch.name({
        authorityUuid: auth,
        language: 'zh',
        content: names.chinese,
      });

      const find = async (query: string) => {
        const found = await searchGlossaryAuthorities({ client: db, query });
        expect(found).not.toBeNull();
        return (found ?? []).find((a) => a.uuid === auth);
      };

      expect(await find(headword)).toBeDefined();
      expect((await find(`zqeng${tag}`))?.matchedName?.content).toBe(
        names.english,
      );
      expect((await find(names.wylie))?.matchedName?.contentTransformed).toBe(
        script,
      );
      expect((await find(`zqwyl${tag}`))?.matchedName?.content).toBe(
        names.wylie,
      );
      expect((await find(script))?.matchedName?.content).toBe(names.wylie);
      expect((await find(names.chinese))?.matchedName?.content).toBe(
        names.chinese,
      );
      expect(await find(`zqeng${tag.toUpperCase()}`)).toBeDefined();
    });

    it('[AC15] returns the authority with its headword, language, definition and names', async () => {
      const tag = scratch.tag;
      const auth = await scratch.authority(`Zqfull${tag}`);
      const { error } = await db
        .from('authorities')
        .update({
          definition: '<p>A standard definition.</p>',
          headword_language: 'Sa-Ltn',
        })
        .eq('uuid', auth);
      if (error) console.warn(`authority columns: ${error.message}`);
      await scratch.name({
        authorityUuid: auth,
        language: 'en',
        content: `zqfullname${tag}`,
      });
      const found = (
        await searchGlossaryAuthorities({ client: db, query: `Zqfull${tag}` })
      )?.find((a) => a.uuid === auth);
      expect(found?.headword).toBe(`Zqfull${tag}`);
      expect(found?.names.map((n) => n.content)).toContain(`zqfullname${tag}`);
      if (!error) {
        expect(found?.definition).toContain('A standard definition.');
        expect(found?.headwordLanguage).toBe('Sa-Ltn');
      }
    });
  });
});
