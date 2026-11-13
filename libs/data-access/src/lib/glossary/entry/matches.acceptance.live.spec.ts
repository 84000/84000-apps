/**
 * @jest-environment node
 */
// DEV-910 acceptance: `findGlossaryEntryMatches`, the possible duplicates a new
// glossary entry is checked against (criterion 9), against a local Supabase.
// Skipped unless DATA_ACCESS_LIVE=1, with SUPABASE_URL (a local URL) and
// SUPABASE_SERVICE_ROLE_KEY. Run this file by its path alone: the flag also
// enables the write suites.
//
// The fixture is built through DEV-880's createGlossaryEntry and removed with
// deleteGlossaryEntry; the scratch works, authorities and names around it are
// removed in afterAll. Reads only otherwise.
import { createClient } from '@supabase/supabase-js';
import { v4 as uuidv4 } from 'uuid';

import type { DataClient } from '../../types';
import { getWorkGlossaryTermsPage } from '../pagination';
import { findGlossaryEntryMatches } from './matches';
import { createGlossaryEntry, deleteGlossaryEntry } from './save';
import type { GlossaryEntryNameInput, GlossarySaveResult } from './types';

const LIVE = process.env['DATA_ACCESS_LIVE'] === '1';
const describeLive = LIVE ? describe : describe.skip;

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

const name = (
  content: string,
  o: Partial<GlossaryEntryNameInput> = {},
): GlossaryEntryNameInput => ({
  language: 'en',
  content,
  contentTransformed: null,
  termType: 'translationMain',
  attestation: null,
  ...o,
});

const created = (result: GlossarySaveResult) => {
  if (!result.success) {
    throw new Error(`create refused (${result.reason}): ${result.error}`);
  }
  return result.entries[0];
};

describeLive('findGlossaryEntryMatches (live)', () => {
  const tag = uuidv4().slice(0, 8);
  let db: DataClient;
  const works: string[] = [];
  const authorities: string[] = [];
  const entries: { workUuid: string; uuid: string }[] = [];

  let workA: string;
  let workB: string;
  let authWisdom: string;
  let authCompassion: string;
  let authOther: string;
  let authUnused: string;
  let authBoOnly: string;

  const WISDOM = `Wisdom ${tag}`;
  const COMPASSION = `Compassion ${tag}`;

  let wisdom: string;
  let compassion: string;
  let other: string;
  let boOnly: string;
  let wisdomInB: string;

  const newWork = async (n: number): Promise<string> => {
    const uuid = uuidv4();
    const { error } = await db
      .from('works')
      .insert({ uuid, title: `data-access matches scratch ${tag}-${n}` });
    check(error, 'insert work');
    works.push(uuid);
    return uuid;
  };

  const newAuthority = async (n: number): Promise<string> => {
    const uuid = uuidv4();
    const { error } = await db.from('authorities').insert({
      uuid,
      xmlId: `data-access-matches-${tag}-${n}`,
      headword: `data-access matches authority ${tag}-${n}`,
    });
    check(error, 'insert authority');
    authorities.push(uuid);
    return uuid;
  };

  const newEntry = async (
    workUuid: string,
    authorityUuid: string,
    names: GlossaryEntryNameInput[],
  ): Promise<string> => {
    const entry = created(
      await createGlossaryEntry({
        client: db,
        workUuid,
        entry: { authorityUuid, names },
      }),
    );
    entries.push({ workUuid, uuid: entry.uuid });
    return entry.uuid;
  };

  const rowCount = async (workUuid: string) => {
    const { count, error } = await db
      .from('glossaries')
      .select('uuid', { count: 'exact', head: true })
      .eq('work_uuid', workUuid);
    check(error, 'count glossaries');
    return count;
  };

  beforeAll(async () => {
    db = liveClient();
    workA = await newWork(1);
    workB = await newWork(2);
    authWisdom = await newAuthority(1);
    authCompassion = await newAuthority(2);
    authOther = await newAuthority(3);
    authUnused = await newAuthority(4);
    authBoOnly = await newAuthority(5);

    wisdom = await newEntry(workA, authWisdom, [name(WISDOM)]);
    compassion = await newEntry(workA, authCompassion, [name(COMPASSION)]);
    other = await newEntry(workA, authOther, [name(`Other ${tag}`)]);
    // A Tibetan name equal to the searched English name is not a match.
    boOnly = await newEntry(workA, authBoOnly, [
      name(`Fourth ${tag}`),
      name(WISDOM, {
        language: 'Bo-Ltn',
        contentTransformed: 'ཤེས་རབ།',
        termType: 'translationAlternative',
      }),
    ]);
    // The same name and authority in another work must not turn up in workA.
    wisdomInB = await newEntry(workB, authWisdom, [name(WISDOM)]);
  });

  afterAll(async () => {
    if (!db) return;
    for (const { workUuid, uuid } of entries) {
      const result = await deleteGlossaryEntry({ client: db, workUuid, uuid });
      if (!result.success) {
        console.warn(`cleanup: delete entry ${uuid}: ${result.error}`);
      }
    }
    const steps: [
      string,
      () => PromiseLike<{ error: { message: string } | null }>,
    ][] = [
      [
        'glossaries',
        () => db.from('glossaries').delete().in('work_uuid', works),
      ],
      [
        'names',
        () => db.from('names').delete().in('authority_uuid', authorities),
      ],
      [
        'authorities',
        () => db.from('authorities').delete().in('uuid', authorities),
      ],
      ['works', () => db.from('works').delete().in('uuid', works)],
    ];
    for (const [what, run] of steps) {
      const { error } = await run();
      if (error) console.warn(`cleanup (${what}): ${error.message}`);
    }
  });

  const find = (args: { english?: string; authorityUuid?: string }) =>
    findGlossaryEntryMatches({ client: db, workUuid: workA, ...args });

  it('finds the entry with the same English name, ignoring case (criterion 9)', async () => {
    for (const english of [
      WISDOM,
      WISDOM.toLowerCase(),
      WISDOM.toUpperCase(),
    ]) {
      const found = await find({ english });
      expect(found).toEqual([
        expect.objectContaining({
          uuid: wisdom,
          english: WISDOM,
          authorityUuid: authWisdom,
          sameName: true,
          sameAuthority: false,
        }),
      ]);
    }
  });

  it('finds the entries that link the same authority (criterion 9)', async () => {
    const found = await find({ authorityUuid: authCompassion });
    expect(found).toEqual([
      expect.objectContaining({
        uuid: compassion,
        english: COMPASSION,
        authorityUuid: authCompassion,
        sameName: false,
        sameAuthority: true,
      }),
    ]);
  });

  it('flags both reasons on one entry when name and authority both match', async () => {
    const found = await find({ english: WISDOM, authorityUuid: authWisdom });
    expect(found).toEqual([
      expect.objectContaining({
        uuid: wisdom,
        sameName: true,
        sameAuthority: true,
      }),
    ]);
  });

  it('lists an entry once per reason: one by name, another by authority', async () => {
    const found = (
      await find({ english: WISDOM, authorityUuid: authCompassion })
    )?.slice();
    expect(found?.map((m) => m.uuid).sort()).toEqual(
      [wisdom, compassion].sort(),
    );
    const byUuid = Object.fromEntries((found ?? []).map((m) => [m.uuid, m]));
    expect(byUuid[wisdom]).toEqual(
      expect.objectContaining({ sameName: true, sameAuthority: false }),
    );
    expect(byUuid[compassion]).toEqual(
      expect.objectContaining({ sameName: false, sameAuthority: true }),
    );
  });

  it('is empty, not null, when neither the name nor the authority matches', async () => {
    expect(await find({ english: `Nothing like it ${tag}` })).toEqual([]);
    expect(await find({ authorityUuid: authUnused })).toEqual([]);
    expect(
      await find({
        english: `Nothing like it ${tag}`,
        authorityUuid: authUnused,
      }),
    ).toEqual([]);
  });

  it('finds nothing for an omitted or empty name and authority', async () => {
    expect(await find({})).toEqual([]);
    expect(await find({ english: '' })).toEqual([]);
    expect(await find({ english: '', authorityUuid: undefined })).toEqual([]);
  });

  it('matches the whole English name, not part of it', async () => {
    expect(await find({ english: WISDOM.slice(0, -2) })).toEqual([]);
    expect(await find({ english: `${WISDOM} and more` })).toEqual([]);
  });

  it('matches English names only, not another language’s', async () => {
    // `boOnly` has the searched text as a Tibetan name, not an English one.
    const found = await find({ english: WISDOM });
    expect(found?.map((m) => m.uuid)).not.toContain(boOnly);
  });

  it('reads the entries of the given work only', async () => {
    const found = await find({ english: WISDOM, authorityUuid: authWisdom });
    expect(found?.map((m) => m.uuid)).not.toContain(wisdomInB);
    const inB = await findGlossaryEntryMatches({
      client: db,
      workUuid: workB,
      english: WISDOM,
      authorityUuid: authWisdom,
    });
    expect(inB?.map((m) => m.uuid)).toEqual([wisdomInB]);
  });

  it('labels each match g.N, as the readers number it, and orders by that number', async () => {
    const found = await find({
      english: WISDOM,
      authorityUuid: authCompassion,
    });
    const page = await getWorkGlossaryTermsPage({
      client: db,
      workUuid: workA,
      source: 'draft',
      limit: 200,
    });
    const numberOf = new Map(
      page.nodes.map((node) => [node.uuid, node.termNumber]),
    );
    expect(found).toHaveLength(2);
    for (const match of found ?? []) {
      expect(match.label).toMatch(/^g\.\d+$/);
      expect(match.label).toBe(`g.${numberOf.get(match.uuid)}`);
    }
    const numbers = (found ?? []).map((m) => Number(m.label.slice(2)));
    expect(numbers).toEqual([...numbers].sort((a, b) => a - b));
  });

  it('never writes', async () => {
    const before = await rowCount(workA);
    await find({ english: WISDOM, authorityUuid: authWisdom });
    await find({ english: `Nothing like it ${tag}` });
    expect(await rowCount(workA)).toBe(before);
  });

  it('is null when the read fails', async () => {
    // Every call chains on and the query resolves to an error.
    const failure = { data: null, count: null, error: { message: 'boom' } };
    const chain: unknown = new Proxy(() => chain, {
      get: (_target, prop) =>
        prop === 'then'
          ? (resolve: (value: unknown) => unknown) => resolve(failure)
          : chain,
      apply: () => chain,
    });
    const broken = chain as DataClient;
    const spy = jest.spyOn(console, 'error').mockImplementation(() => null);
    const found = await findGlossaryEntryMatches({
      client: broken,
      workUuid: workA,
      english: WISDOM,
    });
    spy.mockRestore();
    expect(found).toBeNull();
  });

  it('keeps the other entries out of the result', async () => {
    const found = await find({ english: WISDOM, authorityUuid: authWisdom });
    expect(found?.map((m) => m.uuid)).not.toContain(other);
  });
});
