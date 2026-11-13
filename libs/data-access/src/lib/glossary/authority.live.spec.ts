/**
 * @jest-environment node
 */
// The authority search against a local Supabase seeded with toh8. Read-only.
// Skipped unless DATA_ACCESS_LIVE=1, with SUPABASE_URL (a local URL) and
// SUPABASE_SERVICE_ROLE_KEY.
import { createClient } from '@supabase/supabase-js';

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

describeLive('searchGlossaryAuthorities (live)', () => {
  const client = LIVE ? liveClient() : (null as unknown as DataClient);

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
});
