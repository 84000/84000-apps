/**
 * @jest-environment node
 */
// A glossary entry's instances against a local Supabase seeded with toh8.
// Read-only. Skipped unless DATA_ACCESS_LIVE=1, with SUPABASE_URL (a local
// URL) and SUPABASE_SERVICE_ROLE_KEY.
//
// The passages dialog's own read, `get_glossary_term_excerpts`, is the oracle
// for which instances belong to an entry in a Toh.
import { createClient } from '@supabase/supabase-js';

import type { DataClient } from '../types';
import {
  GLOSSARY_INSTANCES_PAGE_SIZE,
  getGlossaryTermInstances,
} from './term-instances';

const LIVE = process.env['DATA_ACCESS_LIVE'] === '1';
const describeLive = LIVE ? describe : describe.skip;

/** The heaviest term in the local data: 18,697 instances, all in toh8. */
const HEAVIEST = 'ccc27a45-158f-4dd7-810e-cdc6413fbed8';
const HEAVIEST_COUNT = 18697;
/** A term with a few hundred instances, some scoped to toh8 and some not. */
const MEDIUM = '4d4c52b6-89b0-40c3-b343-34be3e7d1398';

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

type Row = NonNullable<
  Awaited<ReturnType<typeof getGlossaryTermInstances>>
>['items'][number];

type DialogPassage = {
  uuid: string;
  sort: number;
  ranges: Array<[number, number]>;
};

/** Every passage the dialog lists for a term, with its instance ranges. */
const dialogPassages = async (
  db: DataClient,
  term: string,
  toh: string | null,
): Promise<DialogPassage[]> => {
  const passages: DialogPassage[] = [];
  for (let offset = 0; ; offset += 100) {
    const { data, error } = await db.rpc('get_glossary_term_excerpts', {
      p_term_uuid: term,
      p_toh: toh,
      p_limit: 100,
      p_offset: offset,
    });
    if (error) throw new Error(error.message);
    const rows = (data ?? []) as Array<{
      uuid: string;
      sort: number;
      ranges: Array<[number | string, number | string]>;
    }>;
    for (const row of rows) {
      passages.push({
        uuid: row.uuid,
        sort: row.sort,
        ranges: row.ranges.map(([s, e]) => [Number(s), Number(e)]),
      });
    }
    if (rows.length < 100) return passages;
  }
};

/** Every page of a term's instances, in the order the read returns them. */
const allInstances = async (
  db: DataClient,
  uuid: string,
  toh: string | undefined,
): Promise<{ rows: Row[]; totalCount: number }> => {
  const rows: Row[] = [];
  let totalCount = 0;
  for (let offset = 0; ; offset += GLOSSARY_INSTANCES_PAGE_SIZE) {
    const page = await getGlossaryTermInstances({
      client: db,
      uuid,
      toh,
      offset,
    });
    if (!page) throw new Error(`read failed at offset ${offset}`);
    totalCount = page.totalCount;
    rows.push(...page.items);
    if (page.items.length < GLOSSARY_INSTANCES_PAGE_SIZE || !page.items.length)
      return { rows, totalCount };
    if (rows.length >= totalCount) return { rows, totalCount };
  }
};

describeLive('glossary term instances against a local database', () => {
  jest.setTimeout(300_000);
  let db: DataClient;

  beforeAll(() => {
    db = liveClient();
  });

  it('reaches the last page of the heaviest entry, holding the remainder', async () => {
    const lastOffset =
      Math.floor((HEAVIEST_COUNT - 1) / GLOSSARY_INSTANCES_PAGE_SIZE) *
      GLOSSARY_INSTANCES_PAGE_SIZE;

    const page = await getGlossaryTermInstances({
      client: db,
      uuid: HEAVIEST,
      toh: 'toh8',
      offset: lastOffset,
    });

    expect(page?.totalCount).toBe(HEAVIEST_COUNT);
    expect(page?.offset).toBe(lastOffset);
    expect(page?.items).toHaveLength(HEAVIEST_COUNT - lastOffset);
  });

  it.each([
    ['the heaviest entry in toh8', HEAVIEST, 'toh8'],
    ['an entry in toh8', MEDIUM, 'toh8'],
    ['the same entry in toh145, which scopes some away', MEDIUM, 'toh145'],
  ])(
    'lists %s as the passages dialog counts it, in its passage order',
    async (_name, term, toh) => {
      const dialog = await dialogPassages(db, term, toh);
      const expected = dialog.flatMap((passage) =>
        passage.ranges.map(([start, end]) => `${passage.uuid}:${start}:${end}`),
      );

      const { rows, totalCount } = await allInstances(db, term, toh);
      const actual = rows.map(
        (row) => `${row.passageUuid}:${row.start}:${row.end}`,
      );

      expect(totalCount).toBe(expected.length);
      expect(new Set(rows.map((row) => row.uuid)).size).toBe(rows.length);
      expect([...actual].sort()).toEqual([...expected].sort());

      const passageOrder: string[] = [];
      for (const row of rows) {
        if (passageOrder[passageOrder.length - 1] !== row.passageUuid) {
          passageOrder.push(row.passageUuid);
        }
      }
      expect(passageOrder).toEqual(dialog.map((passage) => passage.uuid));
    },
  );

  it('shows each instance as the database holds it', async () => {
    const page = await getGlossaryTermInstances({
      client: db,
      uuid: MEDIUM,
      toh: 'toh8',
      first: 25,
    });
    const items = page?.items ?? [];
    expect(items.length).toBeGreaterThan(0);

    const { data: annotations } = await db
      .from('passage_annotations')
      .select('uuid, passage_uuid, type, start, end, content')
      .in(
        'uuid',
        items.map((row) => row.uuid),
      );
    const { data: passages } = await db
      .from('passages')
      .select('uuid, label, sort, type, content')
      .in('uuid', [...new Set(items.map((row) => row.passageUuid))]);

    const annotationByUuid = new Map(
      (annotations ?? []).map((a: Record<string, unknown>) => [
        a['uuid'] as string,
        a,
      ]),
    );
    const passageByUuid = new Map(
      (passages ?? []).map((p: Record<string, unknown>) => [
        p['uuid'] as string,
        p,
      ]),
    );

    for (const row of items) {
      const annotation = annotationByUuid.get(row.uuid);
      const passage = passageByUuid.get(row.passageUuid);
      expect(annotation).toBeDefined();
      expect(passage).toBeDefined();
      expect(annotation?.['type']).toBe('glossary-instance');
      expect(JSON.stringify(annotation?.['content'])).toContain(MEDIUM);
      expect(annotation?.['passage_uuid']).toBe(row.passageUuid);
      expect(Number(annotation?.['start'])).toBe(row.start);
      expect(Number(annotation?.['end'])).toBe(row.end);
      expect(row.passageLabel).toBe(passage?.['label']);
      expect(row.passageSort).toBe(passage?.['sort']);
      expect(row.passageType).toBe(passage?.['type']);
      if (!row.outOfRange) {
        expect(row.text).toBe(
          (passage?.['content'] as string).slice(row.start, row.end),
        );
      }
      expect(
        row.before.split(/\s+/).filter(Boolean).length,
      ).toBeLessThanOrEqual(5);
      expect(row.after.split(/\s+/).filter(Boolean).length).toBeLessThanOrEqual(
        5,
      );
    }
  });
});
