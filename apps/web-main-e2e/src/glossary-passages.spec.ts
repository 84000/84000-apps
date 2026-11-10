import type { Locator, Page, Request } from '@playwright/test';
import { passageByLabel } from './support/db';
import { openEditor, row, settled } from './support/editor';
import { expect, test } from './support/fixtures';
import {
  addInstance,
  expectedPassages,
  indexOfText,
  isPassagesRequest,
  MAX_EXCERPT,
  PAGE_SIZE,
  TERMS,
  unusedEntry,
} from './support/glossary';
import { TEST_WORK } from './support/local-stack';

/**
 * Acceptance checks for the glossary passages dialog in the editor (DEV-885).
 * Each test names the criterion it checks.
 */

/** The open hover card. */
const hoverCard = (page: Page) => page.locator('div.z-100 > div.bg-popover');

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

const nextPage = (page: Page) =>
  dialog(page)
    .locator('button')
    .filter({ hasText: /^\s*Show the next/ });

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

/** A glossary instance in a passage's row, by its text. */
const instanceIn = (page: Page, uuid: string, text: string | RegExp) =>
  row(page, uuid)
    .locator('[type="glossaryInstance"]')
    .filter({ hasText: text });

/** Hovers an instance until its card is up. */
const hoverForCard = async (page: Page, instance: Locator) => {
  await settled(instance);
  await expect(async () => {
    await page.mouse.move(0, 0);
    await instance.hover();
    await expect(hoverCard(page)).toBeVisible({ timeout: 5_000 });
  }).toPass({ timeout: 30_000 });
};

/**
 * Opens the editor with the glossary tab on an entry, and that entry's
 * dialog from its "Passages ›" link. The main panel opens at `at`.
 */
const openDialog = async (
  page: Page,
  termUuid: string,
  { at, toh = TEST_WORK.toh }: { at?: string; toh?: string } = {},
) => {
  await openEditor(page, {
    main: { tab: 'translation', hash: at },
    right: { tab: 'glossary', hash: termUuid },
    toh,
  });
  const link = passagesLinks(entry(page, termUuid));
  await expect(link).toHaveCount(1, { timeout: 60_000 });
  await link.click();
  await expect(dialog(page)).toBeVisible();
};

const greatCompassion = () =>
  expectedPassages({
    workUuid: TEST_WORK.uuid,
    termUuid: TERMS.greatCompassion,
    toh: TEST_WORK.toh,
  });

/** Opens the editor at 2.5 and the dialog of great compassion. */
const openGreatCompassion = async (page: Page) => {
  const p25 = await passageByLabel('2.5');
  await openDialog(page, TERMS.greatCompassion, { at: p25.uuid });
};

test.describe('Glossary passages dialog (DEV-885)', () => {
  test("DEV-885 Glossary tab: each entry has a 'Passages ›' link, and no passages request", async ({
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

  test("DEV-885 Hover card: no 'Passages ›' link, and no passages request", async ({
    page,
  }) => {
    const requests = recordPassagesRequests(page);
    const p25 = await passageByLabel('2.5');
    await openEditor(page, { main: { tab: 'translation', hash: p25.uuid } });
    await hoverForCard(page, instanceIn(page, p25.uuid, /great compassion/i));
    await expect(hoverCard(page)).toContainText('great compassion');
    await expect(passagesLinks(hoverCard(page))).toHaveCount(0);
    await page.waitForTimeout(2_000);
    expect(
      requests.map((r) => r.postData()),
      'no passages request',
    ).toEqual([]);
  });

  test('DEV-885 Opens on click, One excerpt per passage, Excerpts, Reader and editor content: the first page of great compassion', async ({
    page,
  }) => {
    // A second, draft-only instance in 1.18, which says "great compassion"
    // twice: the editor lists draft passages, so it shows.
    const p118 = await passageByLabel('1.18');
    const first = indexOfText(p118.content, 'great compassion');
    const second = indexOfText(p118.content, 'great compassion', first + 1);
    await addInstance({
      passageUuid: p118.uuid,
      glossaryUuid: TERMS.greatCompassion,
      start: second,
      end: second + 'great compassion'.length,
    });
    const expected = await greatCompassion();

    await openGreatCompassion(page);
    const title = dialog(page).getByRole('heading').first();
    await expect(title).toContainText('great compassion');
    await expect(title).toContainText(
      `${expected.length.toLocaleString('en-US')} passages`,
    );

    await expect(excerpts(page)).toHaveCount(PAGE_SIZE);
    const texts = await excerpts(page).allInnerTexts();
    expected.slice(0, PAGE_SIZE).forEach((passage, i) => {
      const text = texts[i];
      expect(text, `excerpt ${i + 1} is ${passage.label}`).toMatch(
        labelPattern(passage.label),
      );
      const uses = passage.instances.length;
      if (uses > 1) {
        expect(text, passage.label).toContain(`${uses} uses`);
      } else {
        expect(text, passage.label).not.toMatch(/\b\d+ uses?\b/);
      }
      // The excerpt shows the passage's first instance and the text after it.
      const i0 = passage.instances[0];
      expect(text.toLowerCase(), passage.label).toContain(
        passage.content.slice(i0.start, i0.end).toLowerCase(),
      );
      if (passage.content.length > MAX_EXCERPT) {
        expect(text, `${passage.label} is cut`).toContain('…');
      }
    });

    const at118 = expected.findIndex((p) => p.uuid === p118.uuid);
    expect(at118).toBeGreaterThanOrEqual(0);
    expect(at118).toBeLessThan(PAGE_SIZE);
    const marks118 = excerpts(page).nth(at118).locator('mark');
    await expect(marks118).toHaveCount(2);
    for (const mark of await marks118.allInnerTexts()) {
      expect(mark.toLowerCase()).toBe('great compassion');
    }
    // Every excerpt highlights the entry.
    for (let i = 0; i < PAGE_SIZE; i++) {
      const marks = await excerpts(page).nth(i).locator('mark').allInnerTexts();
      expect(marks.length).toBe(expected[i].instances.length);
    }
  });

  test('DEV-885 Paging: 20 at a time, to the last passage', async ({
    page,
  }) => {
    const expected = await greatCompassion();
    await openGreatCompassion(page);
    let shown = PAGE_SIZE;
    await expect(excerpts(page)).toHaveCount(shown);
    while (shown < expected.length) {
      await nextPage(page).click();
      shown = Math.min(shown + PAGE_SIZE, expected.length);
      await expect(excerpts(page)).toHaveCount(shown);
    }
    await expect(nextPage(page)).toHaveCount(0);
    const texts = await excerpts(page).allInnerTexts();
    expected.forEach((passage, i) =>
      expect(texts[i], `excerpt ${i + 1}`).toMatch(labelPattern(passage.label)),
    );
    await excerpts(page).last().scrollIntoViewIfNeeded();
    await expect(excerpts(page).last()).toBeInViewport();
  });

  test('DEV-885 Jump: clicking an excerpt closes the dialog and scrolls to the passage', async ({
    page,
  }) => {
    const expected = await greatCompassion();
    const target = expected[0];
    await openGreatCompassion(page);
    await excerpts(page).first().click();
    await expect(dialog(page)).toHaveCount(0);
    await expect(row(page, target.uuid)).toBeInViewport({ timeout: 30_000 });
  });

  test('DEV-885 Current Toh only, Opens on click: Dharma in toh90001 has 1 passage', async ({
    page,
  }) => {
    await openDialog(page, TERMS.dharma, { toh: TEST_WORK.toh });
    const title = dialog(page).getByRole('heading').first();
    await expect(title).toContainText('Dharma');
    await expect(title).toContainText(/(^|\D)1 passage(?!s)/);
    await expect(excerpts(page)).toHaveCount(1);
    await expect(excerpts(page).first()).toContainText(labelPattern('2.124'));
    await expect(nextPage(page)).toHaveCount(0);
  });

  test("DEV-885 No passages: the dialog says the entry isn't linked", async ({
    page,
  }) => {
    const unused = await unusedEntry(TEST_WORK.uuid);
    await openDialog(page, unused.uuid);
    await expect(dialog(page).getByRole('heading').first()).toContainText(
      unused.english,
    );
    await expect(dialog(page)).toContainText(/isn['’]t linked in any passage/);
    await expect(excerpts(page)).toHaveCount(0);
    await expect(nextPage(page)).toHaveCount(0);
  });
});
