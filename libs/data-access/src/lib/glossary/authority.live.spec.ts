/**
 * @jest-environment node
 */
// The authority search against a local Supabase seeded with toh8. Writes
// scratch authorities only, and removes them. Skipped unless
// DATA_ACCESS_LIVE=1, with SUPABASE_URL (a local URL) and
// SUPABASE_SERVICE_ROLE_KEY.
import { createClient } from '@supabase/supabase-js';
import { v4 as uuidv4 } from 'uuid';

import type { DataClient } from '../types';
import { getGlossaryAuthorities, searchGlossaryAuthorities } from './authority';

const LIVE = process.env['DATA_ACCESS_LIVE'] === '1';
const describeLive = LIVE ? describe : describe.skip;

/** Mañjuśrī, headword in Sanskrit, with 53 names. */
const MANJUSRI = '320c5523-4cde-4365-aeb1-3e69be9b0e42';
/** Bodhicitta: Tibetan names "byang chub kyi sems", "sems bskyed" and others. */
const BODHICITTA = '71c3e498-a282-46c2-a1b2-09bff483deac';

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

describeLive('searchGlossaryAuthorities (live)', () => {
  const client = LIVE ? liveClient() : (null as unknown as DataClient);
  const tag = uuidv4().replace(/-/g, '').slice(0, 8);
  const scratch: string[] = [];

  afterAll(async () => {
    if (!scratch.length) return;
    for (const [table, column] of [
      ['names', 'authority_uuid'],
      ['authorities', 'uuid'],
    ] as const) {
      const { error } = await client.from(table).delete().in(column, scratch);
      if (error) console.warn(`scratch cleanup (${table}): ${error.message}`);
    }
  });

  /** A scratch authority with these names. */
  const authorityWith = async (
    headword: string,
    names: { language: string; content: string; script?: string }[],
  ) => {
    const uuid = uuidv4();
    scratch.push(uuid);
    check(
      (
        await client
          .from('authorities')
          .insert({ uuid, xmlId: `authority-live-${tag}`, headword })
      ).error,
      'insert authority',
    );
    check(
      (
        await client.from('names').insert(
          names.map((n) => ({
            uuid: uuidv4(),
            authority_uuid: uuid,
            language: n.language,
            content: n.content,
            content_transformed: n.script ?? null,
          })),
        )
      ).error,
      'insert names',
    );
    return uuid;
  };

  it('finds a headword without its diacritics, first', async () => {
    const found = await searchGlossaryAuthorities({
      client,
      query: 'manjusri',
    });
    expect(found?.[0]?.uuid).toBe(MANJUSRI);
    expect(found?.[0]?.matchedName).toBeNull();
  });

  it('finds an authority by a Wylie name prefix', async () => {
    const found = await searchGlossaryAuthorities({
      client,
      query: 'byang chub kyi se',
    });
    const hit = found?.find((a) => a.uuid === BODHICITTA);
    expect(hit?.matchedName?.content).toBe('byang chub kyi sems');
  });

  it('finds an authority by its Tibetan script', async () => {
    const found = await searchGlossaryAuthorities({
      client,
      query: 'བྱང་ཆུབ་ཀྱི་སེམས།',
    });
    expect(found?.[0]?.uuid).toBe(BODHICITTA);
    expect(found?.[0]?.matchedName?.contentTransformed).toBe(
      'བྱང་ཆུབ་ཀྱི་སེམས།',
    );
  });

  it('reads every name of an authority', async () => {
    const [manjusri] =
      (await getGlossaryAuthorities({
        client,
        uuids: [MANJUSRI],
      })) ?? [];
    expect(manjusri?.names).toHaveLength(53);
    expect(manjusri?.headwordLanguage).toBe('Sa-Ltn');
  });

  it('finds an authority by its headword or by an English, Wylie, script or Chinese name', async () => {
    const headword = `Zqhead${tag}`;
    const script = 'ཀྵཀྵཀྵཀྵཀྵ';
    const english = `zqeng${tag} wording`;
    const wylie = `zqwyl${tag} bla`;
    const chinese = `虛${tag}`;
    const uuid = await authorityWith(headword, [
      { language: 'en', content: english },
      { language: 'Bo-Ltn', content: wylie, script },
      { language: 'zh', content: chinese },
    ]);

    const find = async (query: string) => {
      const found = await searchGlossaryAuthorities({ client, query });
      expect(found).not.toBeNull();
      return (found ?? []).find((a) => a.uuid === uuid);
    };

    expect(await find(headword)).toBeDefined();
    expect((await find(`zqeng${tag}`))?.matchedName?.content).toBe(english);
    expect((await find(wylie))?.matchedName?.contentTransformed).toBe(script);
    expect((await find(`zqwyl${tag}`))?.matchedName?.content).toBe(wylie);
    expect((await find(script))?.matchedName?.content).toBe(wylie);
    expect((await find(chinese))?.matchedName?.content).toBe(chinese);
    expect(await find(`zqeng${tag.toUpperCase()}`)).toBeDefined();
  });
});
