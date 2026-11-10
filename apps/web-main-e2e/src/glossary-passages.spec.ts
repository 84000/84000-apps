import type { Locator, Page, Request } from '@playwright/test';
import { db, passageByLabel, passageByUuid } from './support/db';
import { openEditor, row } from './support/editor';
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
  isPassagesRequest,
  MAX_EXCERPT,
  PAGE_SIZE,
  TERMS,
  TOH8_WORK,
} from './support/glossary';
import { TEST_WORK } from './support/local-stack';

/**
 * The passages a glossary entry is cited in: the `glossaryTermExcerpts`
 * query against the local database, and the dialog the glossary tab opens.
 * What each passage should show is worked out from the draft tables.
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

const greatCompassion = (toh: string = TEST_WORK.toh) =>
  expectedPassages({
    workUuid: TEST_WORK.uuid,
    termUuid: TERMS.greatCompassion,
    toh,
  });

/** Links the second "great compassion" in 1.18, which links only the first. */
const linkSecondInstanceOf118 = async () => {
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
  return passage;
};

test.describe('Glossary passages query', () => {
  // These ask the API directly, so one browser is enough.
  test.skip(({ browserName }) => browserName !== 'chromium', 'API only');

  test('pages through every passage of an entry, one excerpt each, to the last', async ({
    request,
  }) => {
    test.setTimeout(900_000);
    const p118 = await linkSecondInstanceOf118();
    const expected = await greatCompassion();
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

    await test.step('a passage citing the entry twice is one excerpt with both marked', () => {
      const item = must(
        pages[0].items.find((i) => i.uuid === p118.uuid),
        '1.18 on the first page',
      );
      expect(item.instanceCount).toBe(2);
      // The whole passage fits, so nothing is cut.
      expect(p118.content.length).toBeLessThanOrEqual(MAX_EXCERPT);
      expect(item.text.replace(ELLIPSIS, '')).toBe(p118.content);
      expect(item.truncatedStart).toBe(false);
      expect(item.truncatedEnd).toBe(false);
      expect(
        item.highlights.map((h) =>
          item.text.slice(h.start, h.end).toLowerCase(),
        ),
      ).toEqual(['great compassion', 'great compassion']);
      const others = pages[0].items.filter((i) => i.uuid !== p118.uuid);
      expect(others.every((i) => i.instanceCount === 1)).toBe(true);
    });

    await test.step('passages longer than the limit are cut around their first instance', () => {
      const long = expected.filter((p) => p.content.length > MAX_EXCERPT);
      expect(long.length, 'the fixture has long passages').toBeGreaterThan(0);
      for (const passage of long) {
        const item = items.find((i) => i.uuid === passage.uuid);
        checkExcerpt(must(item, `excerpt of ${passage.label}`), passage);
      }
    });

    await test.step('the heaviest entry pages to its last passage', async () => {
      const heaviest = await expectedPassages({
        workUuid: TOH8_WORK,
        termUuid: HEAVIEST_TERM,
        toh: 'toh8',
      });
      expect(heaviest.length).toBeGreaterThan(1000);
      const all = await allExcerpts(request, {
        uuid: HEAVIEST_TERM,
        toh: 'toh8',
      });
      expect(all.pages[0].totalCount).toBe(heaviest.length);
      expect(all.items.length).toBe(heaviest.length);
      expect(
        all.pages.every(
          (p, i) => i === all.pages.length - 1 || p.items.length === PAGE_SIZE,
        ),
      ).toBe(true);
      checkAll(all.items, heaviest, { content: false });
      expect(all.items.at(-1)?.uuid).toBe(heaviest.at(-1)?.uuid);
      // Spot-check the excerpts at both ends.
      for (const item of [
        ...all.items.slice(0, PAGE_SIZE),
        ...all.items.slice(-PAGE_SIZE),
      ]) {
        checkExcerpt(
          item,
          must(
            heaviest.find((p) => p.uuid === item.uuid),
            item.uuid,
          ),
        );
      }
    });
  });

  test("lists only the current Toh's instances and passages", async ({
    request,
  }) => {
    await test.step('an instance scoped to the other Toh is not listed or counted', async () => {
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
      await test.step(`passages and counts follow ${toh}`, async () => {
        const expected = await greatCompassion(toh);
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

  test("ignores instances that cite one of the entry's child rows", async ({
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

    // 1.12 says "bodhisattva" but has no instance of the entry itself.
    const p112 = await passageByLabel('1.12');
    expect(listed.has(p112.uuid)).toBe(false);
    const at = indexOfText(p112.content, 'bodhisattva');
    await addInstance({
      passageUuid: p112.uuid,
      glossaryUuid: childUuid,
      start: at,
      end: at + 'bodhisattva'.length,
    });
    // A passage already listed gets an instance of the child row too.
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
    expect(after.pages[0].totalCount).toBe(before?.totalCount);
    expect(after.pages[0].totalCount).toBe(expected.length);
    checkAll(after.items, expected);
    expect(after.items.some((i) => i.uuid === p112.uuid)).toBe(false);
    expect(
      after.items.find((i) => i.uuid === already.uuid)?.instanceCount,
    ).toBe(already.instanceCount);
  });

  test('shows draft changes to the editor and not to the reader', async ({
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

const PASSAGES_LINK = /^\s*Passages\s*›\s*$/;

/** "Passages ›" links inside `scope`. */
const passagesLinks = (scope: Locator) =>
  scope.locator('button, a').filter({ hasText: PASSAGES_LINK });

/** The side panel. */
const rightPanel = (page: Page) => page.locator('[data-panel="right"]');

/** A glossary entry in the side panel's glossary tab, by its uuid. */
const entry = (page: Page, uuid: string) =>
  rightPanel(page).locator(`[id="${uuid}"]`).filter({ visible: true });

const dialog = (page: Page) => page.getByRole('dialog');

/** The dialog's excerpts: the buttons that show an instance. */
const excerpts = (page: Page) =>
  dialog(page)
    .locator('button')
    .filter({ has: page.locator('mark') });

/** Matches a passage label on its own, so `1.1` does not match `1.13`. */
const labelPattern = (label: string) =>
  new RegExp(`(^|[^\\d.])${label.replace(/\./g, '\\.')}(?![\\d.])`);

/** Records the passages requests the page makes from now on. */
const recordPassagesRequests = (page: Page): Request[] => {
  const seen: Request[] = [];
  page.on('request', (r) => {
    if (isPassagesRequest(r)) seen.push(r);
  });
  return seen;
};

test.describe('Glossary passages dialog', () => {
  test('the glossary tab gives each entry a passages link without asking for passages', async ({
    page,
  }) => {
    const requests = recordPassagesRequests(page);
    await openEditor(page, { right: { tab: 'glossary' } });
    const panel = rightPanel(page);
    // Entries carry their number, g.N; the section's own "g." label does not.
    const numbers = panel.getByText(/^\s*g\.\d+\s*$/).filter({ visible: true });
    await expect(numbers.first()).toBeVisible({ timeout: 60_000 });

    const box = await panel.boundingBox();
    if (!box) throw new Error('the glossary panel has no box');
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    for (let i = 0; i < 15; i++) {
      await page.mouse.wheel(0, 1200);
      await page.waitForTimeout(200);
    }
    await page.waitForTimeout(2_000);

    expect(
      requests.map((r) => r.postData()),
      'no passages request',
    ).toEqual([]);
    // One link per entry drawn, where the passage links used to be.
    await expect
      .poll(async () => {
        const entries = await numbers.count();
        const links = await passagesLinks(panel)
          .filter({ visible: true })
          .count();
        return entries > 0 && links === entries;
      })
      .toBe(true);
    await expect(
      panel
        .locator('button, a')
        // Passage labels, not the tab's own entry numbers (g.1, g.2 …).
        .filter({ hasText: /^\s*(?!g\.)([a-z]+|\d+)(\.\d+)+\s*$/ })
        .filter({ visible: true }),
      'no passage links',
    ).toHaveCount(0);
    await expect(
      panel.locator('button').filter({ hasText: /^\s*more\s*›\s*$/ }),
    ).toHaveCount(0);

    // The probe sees the request once a link asks for passages.
    await passagesLinks(panel).filter({ visible: true }).first().click();
    await expect(dialog(page)).toBeVisible();
    await expect.poll(() => requests.length).toBeGreaterThan(0);
  });

  test("an entry's link opens its passages, and an excerpt jumps to its passage", async ({
    page,
  }) => {
    const expected = await greatCompassion();
    const target = expected[0];
    const p25 = await passageByLabel('2.5');
    await openEditor(page, {
      main: { tab: 'translation', hash: p25.uuid },
      right: { tab: 'glossary', hash: TERMS.greatCompassion },
    });
    const link = passagesLinks(entry(page, TERMS.greatCompassion));
    await expect(link).toHaveCount(1, { timeout: 60_000 });
    await link.click();
    await expect(dialog(page)).toBeVisible();

    const title = dialog(page).getByRole('heading').first();
    await expect(title).toContainText('great compassion');
    await expect(title).toContainText(
      `${expected.length.toLocaleString('en-US')} passages`,
    );
    await expect(excerpts(page)).toHaveCount(PAGE_SIZE);
    const texts = await excerpts(page).allInnerTexts();
    expected
      .slice(0, PAGE_SIZE)
      .forEach((passage, i) =>
        expect(texts[i], `excerpt ${i + 1} is ${passage.label}`).toMatch(
          labelPattern(passage.label),
        ),
      );

    // The next page comes through the client's cursor, not page 1 again.
    await dialog(page)
      .locator('button')
      .filter({ hasText: /^\s*Show the next/ })
      .click();
    await expect(excerpts(page)).toHaveCount(
      Math.min(2 * PAGE_SIZE, expected.length),
    );
    await expect(excerpts(page).nth(PAGE_SIZE)).toContainText(
      labelPattern(expected[PAGE_SIZE].label),
    );

    await excerpts(page).first().click();
    await expect(dialog(page)).toHaveCount(0);
    await expect(row(page, target.uuid)).toBeInViewport({ timeout: 30_000 });
  });
});
