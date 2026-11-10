import { db, passageByLabel, passageByUuid } from './support/db';
import { expect, test } from './support/fixtures';
import {
  addInstance,
  allExcerpts,
  type Excerpt,
  excerptsPage,
  expectedPassages,
  type ExpectedPassage,
  HEAVIEST_TERM,
  indexOfText,
  MAX_EXCERPT,
  PAGE_SIZE,
  TERMS,
  TOH8_WORK,
  unusedEntry,
} from './support/glossary';
import { TEST_WORK } from './support/local-stack';

/**
 * Acceptance checks for the `glossaryTermExcerpts` query behind the glossary
 * passages dialog (DEV-885), against the draft tables of the local stack.
 * Each test names the criterion it checks.
 */

const ELLIPSIS = /^…|…$/g;

/** A value the test needs, failing with `what` when it is missing. */
const must = <T>(value: T | null | undefined, what: string): T => {
  if (value === null || value === undefined) throw new Error(`no ${what}`);
  return value;
};

/** Where an excerpt's text sits in its passage, with the instance it shows. */
const placeExcerpt = (item: Excerpt, passage: ExpectedPassage) => {
  const lead = item.text.startsWith('…') ? 1 : 0;
  const core = item.text.replace(ELLIPSIS, '');
  const first = passage.instances[0];
  // The window that holds the first instance, if the text occurs twice.
  let offset = passage.content.indexOf(core);
  while (
    offset >= 0 &&
    !(offset <= first.start && first.end <= offset + core.length)
  ) {
    offset = passage.content.indexOf(core, offset + 1);
  }
  return { lead, core, offset };
};

/** Checks one excerpt against the passage it should show. */
const checkExcerpt = (item: Excerpt, passage: ExpectedPassage) => {
  const what = `excerpt of ${passage.label}`;
  expect(item.label, what).toBe(passage.label);
  expect(item.type, what).toBe(passage.type);
  expect(item.sort, what).toBe(passage.sort);
  expect(item.instanceCount, what).toBe(passage.instances.length);

  const { lead, core, offset } = placeExcerpt(item, passage);
  expect(core.length, `${what} length`).toBeLessThanOrEqual(MAX_EXCERPT);
  expect(
    offset,
    `${what}: its text is a window of the passage around the first instance`,
  ).toBeGreaterThanOrEqual(0);
  expect(item.truncatedStart, `${what} cut at the start`).toBe(offset > 0);
  expect(item.truncatedEnd, `${what} cut at the end`).toBe(
    offset + core.length < passage.content.length,
  );
  if (passage.content.length > MAX_EXCERPT) {
    expect(item.truncatedStart || item.truncatedEnd, what).toBe(true);
  }

  const windowEnd = offset + core.length;
  const inside = passage.instances.filter(
    (i) => i.start >= offset && i.end <= windowEnd,
  );
  const shown = item.highlights.map((h) => ({
    start: h.start - lead + offset,
    end: h.end - lead + offset,
  }));
  for (const instance of inside) {
    expect(shown, `${what} highlights every instance inside it`).toContainEqual(
      instance,
    );
  }
  for (const h of shown) {
    const of = passage.instances.find(
      (i) =>
        (h.start === i.start || h.start === offset) &&
        (h.end === i.end || h.end === windowEnd) &&
        h.start >= i.start &&
        h.end <= i.end,
    );
    expect(
      of,
      `${what}: highlight ${JSON.stringify(h)} is an instance`,
    ).toBeTruthy();
  }
};

/** Checks a whole result against the expected passages, in order. */
const checkAll = (
  items: Excerpt[],
  expected: ExpectedPassage[],
  { content = true } = {},
) => {
  expect(new Set(items.map((i) => i.uuid)).size, 'each passage once').toBe(
    items.length,
  );
  const sorts = items.map((i) => i.sort);
  expect(sorts, 'passage order').toEqual([...sorts].sort((a, b) => a - b));
  expect(new Set(items.map((i) => i.uuid))).toEqual(
    new Set(expected.map((p) => p.uuid)),
  );
  if (!content) return;
  const byUuid = new Map(expected.map((p) => [p.uuid, p]));
  for (const item of items)
    checkExcerpt(item, must(byUuid.get(item.uuid), item.uuid));
};

test.describe('Glossary passages: excerpts query (DEV-885)', () => {
  // These ask the API directly, so one browser is enough.
  test.skip(({ browserName }) => browserName !== 'chromium', 'API only');

  test('DEV-885 One excerpt per passage, Excerpts, Paging: every passage of great compassion, 20 at a time', async ({
    request,
  }) => {
    const expected = await expectedPassages({
      workUuid: TEST_WORK.uuid,
      termUuid: TERMS.greatCompassion,
      toh: TEST_WORK.toh,
    });
    expect(expected.length).toBeGreaterThan(2 * PAGE_SIZE);

    const { pages, items } = await allExcerpts(request, {
      uuid: TERMS.greatCompassion,
      toh: TEST_WORK.toh,
    });
    expect(pages.length).toBe(Math.ceil(expected.length / PAGE_SIZE));
    pages.forEach((page, i) => {
      expect(page.totalCount, 'totalCount counts passages').toBe(
        expected.length,
      );
      const last = i === pages.length - 1;
      expect(page.items.length).toBe(
        last ? expected.length - PAGE_SIZE * i : PAGE_SIZE,
      );
      expect(page.hasMore).toBe(!last);
    });
    checkAll(items, expected);
    expect(items.map((i) => i.label)).toEqual(expected.map((p) => p.label));
  });

  test('DEV-885 Excerpts: an excerpt counts and highlights every instance in its passage', async ({
    request,
  }) => {
    // 1.18 says "great compassion" twice and links only the first.
    const passage = await passageByLabel('1.18');
    const first = indexOfText(passage.content, 'great compassion');
    const second = indexOfText(passage.content, 'great compassion', first + 1);
    expect(second).toBeGreaterThan(first);
    await addInstance({
      passageUuid: passage.uuid,
      glossaryUuid: TERMS.greatCompassion,
      start: second,
      end: second + 'great compassion'.length,
    });

    const page = await excerptsPage(request, {
      uuid: TERMS.greatCompassion,
      toh: TEST_WORK.toh,
    });
    const item = page?.items.find((i) => i.uuid === passage.uuid);
    expect(item, '1.18 is on the first page').toBeTruthy();
    expect(item?.instanceCount).toBe(2);
    // The whole passage fits, so nothing is cut.
    expect(passage.content.length).toBeLessThanOrEqual(MAX_EXCERPT);
    expect(item?.text.replace(ELLIPSIS, '')).toBe(passage.content);
    expect(item?.truncatedStart).toBe(false);
    expect(item?.truncatedEnd).toBe(false);
    expect(
      item?.highlights.map((h) =>
        item.text.slice(h.start, h.end).toLowerCase(),
      ),
    ).toEqual(['great compassion', 'great compassion']);
    const others = page?.items.filter((i) => i.uuid !== passage.uuid) ?? [];
    expect(others.every((i) => i.instanceCount === 1)).toBe(true);
  });

  test('DEV-885 Excerpts: a passage longer than 300 characters is cut around its first instance', async ({
    request,
  }) => {
    const expected = await expectedPassages({
      workUuid: TEST_WORK.uuid,
      termUuid: TERMS.greatCompassion,
      toh: TEST_WORK.toh,
    });
    const long = expected.filter((p) => p.content.length > MAX_EXCERPT);
    expect(long.length, 'the fixture has long passages').toBeGreaterThan(0);
    const { items } = await allExcerpts(request, {
      uuid: TERMS.greatCompassion,
      toh: TEST_WORK.toh,
    });
    for (const passage of long) {
      const item = items.find((i) => i.uuid === passage.uuid);
      checkExcerpt(must(item, `excerpt of ${passage.label}`), passage);
    }
  });

  test('DEV-885 Paging: the last passage of the heaviest entry can be reached', async ({
    request,
  }) => {
    test.setTimeout(900_000);
    const expected = await expectedPassages({
      workUuid: TOH8_WORK,
      termUuid: HEAVIEST_TERM,
      toh: 'toh8',
    });
    expect(expected.length).toBeGreaterThan(1000);
    const { pages, items } = await allExcerpts(request, {
      uuid: HEAVIEST_TERM,
      toh: 'toh8',
    });
    expect(pages[0].totalCount).toBe(expected.length);
    expect(items.length).toBe(expected.length);
    expect(
      pages.every(
        (p, i) => i === pages.length - 1 || p.items.length === PAGE_SIZE,
      ),
    ).toBe(true);
    checkAll(items, expected, { content: false });
    expect(items.at(-1)?.uuid).toBe(expected.at(-1)?.uuid);
    // Spot-check the excerpts at both ends.
    for (const item of [
      ...items.slice(0, PAGE_SIZE),
      ...items.slice(-PAGE_SIZE),
    ]) {
      checkExcerpt(
        item,
        must(
          expected.find((p) => p.uuid === item.uuid),
          item.uuid,
        ),
      );
    }
  });

  test('DEV-885 Current Toh only: an instance scoped to the other Toh is not listed or counted', async ({
    request,
  }) => {
    // The seeded Dharma instance in 2.124 belongs to toh90001 only.
    const dharma90001 = await excerptsPage(request, {
      uuid: TERMS.dharma,
      toh: TEST_WORK.toh,
    });
    expect(dharma90001?.totalCount).toBe(1);
    expect(dharma90001?.items.map((i) => i.label)).toEqual(['2.124']);
    const dharma90002 = await excerptsPage(request, {
      uuid: TERMS.dharma,
      toh: TEST_WORK.otherToh,
    });
    expect(dharma90002?.totalCount).toBe(0);
    expect(dharma90002?.items).toEqual([]);
    expect(dharma90002?.hasMore).toBe(false);
  });

  test('DEV-885 Current Toh only: a passage of the other Toh is not listed, and the count and paging follow', async ({
    request,
  }) => {
    // n.5 has a variant per Toh. Link "moon" in toh90002's variant.
    const n5 = await passageByLabel('n.5', TEST_WORK.otherToh);
    const at = indexOfText(n5.content, 'moon');
    await addInstance({
      passageUuid: n5.uuid,
      glossaryUuid: TERMS.greatCompassion,
      start: at,
      end: at + 4,
    });
    // And a second instance in 1.13, scoped to toh90002 by the annotation.
    const p113 = await passageByLabel('1.13');
    await addInstance({
      passageUuid: p113.uuid,
      glossaryUuid: TERMS.greatCompassion,
      start: 0,
      end: 4,
      toh: TEST_WORK.otherToh,
    });

    for (const toh of [TEST_WORK.toh, TEST_WORK.otherToh]) {
      await test.step(toh, async () => {
        const expected = await expectedPassages({
          workUuid: TEST_WORK.uuid,
          termUuid: TERMS.greatCompassion,
          toh,
        });
        const { pages, items } = await allExcerpts(request, {
          uuid: TERMS.greatCompassion,
          toh,
        });
        expect(pages[0].totalCount).toBe(expected.length);
        expect(pages.length).toBe(Math.ceil(expected.length / PAGE_SIZE));
        checkAll(items, expected);
        const has = (uuid: string) => items.some((i) => i.uuid === uuid);
        expect(has(n5.uuid)).toBe(toh === TEST_WORK.otherToh);
        expect(items.find((i) => i.uuid === p113.uuid)?.instanceCount).toBe(
          toh === TEST_WORK.otherToh ? 2 : 1,
        );
      });
    }
  });

  test('DEV-885 Instances on child rows: an instance of a child row counts as the entry', async ({
    request,
  }) => {
    const { data: child } = await db()
      .from('glossary_edges')
      .select('child_uuid')
      .eq('parent_uuid', TERMS.bodhisattva)
      .neq('child_uuid', TERMS.bodhisattva)
      .limit(1)
      .single();
    const childUuid = child?.child_uuid as string;
    expect(childUuid).toBeTruthy();

    const before = await excerptsPage(request, {
      uuid: TERMS.bodhisattva,
      toh: TEST_WORK.toh,
    });
    const listed = new Set(before?.items.map((i) => i.uuid));

    // 1.12 says "bodhisattva" but does not link it.
    const p112 = await passageByLabel('1.12');
    expect(listed.has(p112.uuid)).toBe(false);
    const at = indexOfText(p112.content, 'bodhisattva');
    await addInstance({
      passageUuid: p112.uuid,
      glossaryUuid: childUuid,
      start: at,
      end: at + 'bodhisattva'.length,
    });
    // A passage already listed gets a second instance, through the child row.
    const already = must(before?.items[0], 'listed bodhisattva passage');
    const passage = must(await passageByUuid(already.uuid), already.uuid);
    await addInstance({
      passageUuid: passage.uuid,
      glossaryUuid: childUuid,
      start: 0,
      end: 4,
    });

    const expected = await expectedPassages({
      workUuid: TEST_WORK.uuid,
      termUuid: TERMS.bodhisattva,
      toh: TEST_WORK.toh,
    });
    const after = await allExcerpts(request, {
      uuid: TERMS.bodhisattva,
      toh: TEST_WORK.toh,
    });
    expect(after.pages[0].totalCount).toBe((before?.totalCount ?? 0) + 1);
    expect(after.pages[0].totalCount).toBe(expected.length);
    checkAll(after.items, expected);
    const added = after.items.find((i) => i.uuid === p112.uuid);
    expect(added?.instanceCount).toBe(1);
    expect(
      added?.highlights.map((h) => added.text.slice(h.start, h.end)),
    ).toEqual(['bodhisattva']);
    expect(
      after.items.find((i) => i.uuid === already.uuid)?.instanceCount,
    ).toBe(already.instanceCount + 1);
  });

  test('DEV-885 No passages: an entry with no instances has none', async ({
    request,
  }) => {
    const entry = await unusedEntry(TEST_WORK.uuid);
    const page = await excerptsPage(request, {
      uuid: entry.uuid,
      toh: TEST_WORK.toh,
    });
    expect(page).toEqual({
      items: [],
      totalCount: 0,
      nextCursor: null,
      hasMore: false,
    });
  });

  test('DEV-885 Reader and editor content: draft changes show in the editor, not in the reader', async ({
    request,
  }) => {
    const published = await excerptsPage(request, {
      uuid: TERMS.greatCompassion,
      toh: TEST_WORK.toh,
      source: 'published',
    });
    const { data: work } = await db()
      .from('works')
      .select('published_version_uuid')
      .eq('uuid', TEST_WORK.uuid)
      .single();
    if (!work?.published_version_uuid) {
      // Not published locally: the reader has no passages to list.
      expect(published?.items ?? []).toEqual([]);
      expect(published?.totalCount ?? 0).toBe(0);
    }

    // 1.12 mentions great compassion without linking it. Link it in the draft.
    const p112 = await passageByLabel('1.12');
    const at = indexOfText(p112.content, 'great compassion');
    await addInstance({
      passageUuid: p112.uuid,
      glossaryUuid: TERMS.greatCompassion,
      start: at,
      end: at + 'great compassion'.length,
    });

    const draft = await allExcerpts(request, {
      uuid: TERMS.greatCompassion,
      toh: TEST_WORK.toh,
    });
    expect(draft.items.some((i) => i.uuid === p112.uuid)).toBe(true);
    const publishedAfter = await excerptsPage(request, {
      uuid: TERMS.greatCompassion,
      toh: TEST_WORK.toh,
      source: 'published',
    });
    expect(publishedAfter?.totalCount ?? null).toBe(
      published?.totalCount ?? null,
    );
    expect(publishedAfter?.items.map((i) => i.uuid) ?? []).not.toContain(
      p112.uuid,
    );
  });
});
