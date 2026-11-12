/**
 * @jest-environment node
 */
// Acceptance tests for DEV-912 criteria 2 to 4 against a local Supabase that
// holds a copy of the glossary data. Read-only: nothing here writes. Skipped
// unless DATA_ACCESS_LIVE=1, with SUPABASE_URL (a local URL) and
// SUPABASE_SERVICE_ROLE_KEY (the local secret key).
//
// The oracle for "the same instances as the passages dialog" is the dialog's
// own read, `get_glossary_term_excerpts`, which lists one row per passage with
// the ranges of every instance in it.
import { createClient } from '@supabase/supabase-js';

import {
  GLOSSARY_INSTANCES_PAGE_SIZE,
  getGlossaryTermInstances,
} from '../../index';
import type { DataClient } from '../../types';

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
): Promise<{ rows: Row[]; totalCount: number; pages: number }> => {
  const rows: Row[] = [];
  let totalCount = 0;
  let pages = 0;
  for (let offset = 0; ; offset += GLOSSARY_INSTANCES_PAGE_SIZE) {
    const page = await getGlossaryTermInstances({
      client: db,
      uuid,
      toh,
      offset,
    });
    if (!page) throw new Error(`read failed at offset ${offset}`);
    totalCount = page.totalCount;
    pages++;
    rows.push(...page.items);
    if (page.items.length < GLOSSARY_INSTANCES_PAGE_SIZE || !page.items.length)
      return { rows, totalCount, pages };
    if (rows.length >= totalCount) return { rows, totalCount, pages };
  }
};

const inOrder = (rows: Row[]) =>
  rows.every((row, i) => {
    const prev = rows[i - 1];
    if (!prev) return true;
    if (row.passageSort !== prev.passageSort)
      return row.passageSort > prev.passageSort;
    if (row.passageUuid === prev.passageUuid) return row.start >= prev.start;
    return true;
  });

describeLive(
  'DEV-912 getGlossaryTermInstances against a local database',
  () => {
    jest.setTimeout(300_000);
    let db: DataClient;

    beforeAll(() => {
      db = liveClient();
    });

    describe('criterion 3: order and paging for the heaviest term', () => {
      it('criterion 3: counts every instance of the heaviest term in its Toh', async () => {
        const page = await getGlossaryTermInstances({
          client: db,
          uuid: HEAVIEST,
          toh: 'toh8',
        });

        expect(page?.totalCount).toBe(HEAVIEST_COUNT);
        expect(page?.offset).toBe(0);
        expect(page?.items).toHaveLength(GLOSSARY_INSTANCES_PAGE_SIZE);
      });

      it('criterion 3: the last page can be reached and holds the remainder', async () => {
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

      it('criterion 3: a page asks for no more than a page of rows', async () => {
        const page = await getGlossaryTermInstances({
          client: db,
          uuid: HEAVIEST,
          toh: 'toh8',
          first: 10,
          offset: 20,
        });

        expect(page?.items).toHaveLength(10);
        expect(page?.offset).toBe(20);
      });

      it('criterion 3: paging through the whole term lists each instance once, in passage then start order', async () => {
        const { rows, totalCount, pages } = await allInstances(
          db,
          HEAVIEST,
          'toh8',
        );

        expect(totalCount).toBe(HEAVIEST_COUNT);
        expect(pages).toBe(
          Math.ceil(HEAVIEST_COUNT / GLOSSARY_INSTANCES_PAGE_SIZE),
        );
        expect(rows).toHaveLength(HEAVIEST_COUNT);
        expect(new Set(rows.map((row) => row.uuid)).size).toBe(HEAVIEST_COUNT);
        expect(inOrder(rows)).toBe(true);
      });

      it('criterion 3: the same page read twice is the same rows', async () => {
        const read = () =>
          getGlossaryTermInstances({
            client: db,
            uuid: HEAVIEST,
            toh: 'toh8',
            offset: 9000,
          });

        const [a, b] = [await read(), await read()];

        expect(a?.items.map((row) => row.uuid)).toEqual(
          b?.items.map((row) => row.uuid),
        );
      });
    });

    describe('criterion 4: the same instances as the passages dialog', () => {
      it.each([
        ['the heaviest term in toh8', HEAVIEST, 'toh8'],
        ['a medium term in toh8', MEDIUM, 'toh8'],
        ['a medium term in toh145, which scopes some away', MEDIUM, 'toh145'],
      ])(
        'criterion 4: %s lists the instances the dialog counts',
        async (_n, term, toh) => {
          const dialog = await dialogPassages(db, term, toh);
          const expected = dialog.flatMap((passage) =>
            passage.ranges.map(
              ([start, end]) => `${passage.uuid}:${start}:${end}`,
            ),
          );

          const { rows, totalCount } = await allInstances(db, term, toh);
          const actual = rows.map(
            (row) => `${row.passageUuid}:${row.start}:${row.end}`,
          );

          expect(totalCount).toBe(expected.length);
          expect([...actual].sort()).toEqual([...expected].sort());
        },
      );

      it('criterion 4: the Toh changes what is listed', async () => {
        const inToh8 = await allInstances(db, MEDIUM, 'toh8');
        const inToh145 = await allInstances(db, MEDIUM, 'toh145');

        expect(inToh145.totalCount).toBeLessThan(inToh8.totalCount);
      });

      it('criterion 4: rows follow the passage order the dialog uses', async () => {
        const dialog = await dialogPassages(db, MEDIUM, 'toh8');
        const { rows } = await allInstances(db, MEDIUM, 'toh8');

        const passageOrder: string[] = [];
        for (const row of rows) {
          if (passageOrder[passageOrder.length - 1] !== row.passageUuid) {
            passageOrder.push(row.passageUuid);
          }
        }

        expect(passageOrder).toEqual(dialog.map((passage) => passage.uuid));
      });
    });

    describe('criterion 2: a row shows what the database holds', () => {
      it('criterion 2: each row is an instance annotation of the term, with its passage label, text and offsets', async () => {
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
          (annotations ?? []).map((a) => [a.uuid as string, a]),
        );
        const passageByUuid = new Map(
          (passages ?? []).map((p) => [p.uuid as string, p]),
        );

        for (const row of items) {
          const annotation = annotationByUuid.get(row.uuid);
          const passage = passageByUuid.get(row.passageUuid);
          expect(annotation).toBeDefined();
          expect(passage).toBeDefined();
          expect(annotation?.type).toBe('glossary-instance');
          expect(JSON.stringify(annotation?.content)).toContain(MEDIUM);
          expect(annotation?.passage_uuid).toBe(row.passageUuid);
          expect(Number(annotation?.start)).toBe(row.start);
          expect(Number(annotation?.end)).toBe(row.end);
          expect(row.passageLabel).toBe(passage?.label);
          expect(row.passageSort).toBe(passage?.sort);
          expect(row.passageType).toBe(passage?.type);
          if (!row.outOfRange) {
            expect(row.text).toBe(
              (passage?.content as string).slice(row.start, row.end),
            );
          }
          expect(
            row.before.split(/\s+/).filter(Boolean).length,
          ).toBeLessThanOrEqual(5);
          expect(
            row.after.split(/\s+/).filter(Boolean).length,
          ).toBeLessThanOrEqual(5);
        }
      });
    });
  },
);
