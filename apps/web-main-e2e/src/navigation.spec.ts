import type { Locator, Page } from '@playwright/test';
import { passageByLabel, passageByUuid, sectionPassages } from './support/db';
import {
  caretAtEnd,
  openEditor,
  row,
  saveButton,
  settled,
  tab,
} from './support/editor';
import { expect, test } from './support/fixtures';
import { TEST_WORK } from './support/local-stack';

/** The text the editor's deep-link highlight covers, if any. */
const deepLinkText = (page: Page): Promise<string> =>
  page.evaluate(() => {
    const highlights = (
      globalThis as unknown as {
        CSS: { highlights?: Map<string, Iterable<Range>> };
      }
    ).CSS.highlights;
    const ranges = highlights?.get('deep-link');
    return ranges ? [...ranges].map((r) => r.toString()).join('') : '';
  });

/**
 * The text of a comment thread's anchors when the panel paints them as the
 * selected thread, or '' when it does not. The panel paints with a stylesheet
 * rule rather than a deep-link highlight, so this reads both.
 */
const paintedAnchorText = (page: Page, thread: string): Promise<string> =>
  page.evaluate((uuid) => {
    const selector = `span[type="comment"][comment="${uuid}"]`;
    const sheet = (
      document.getElementById(
        'comment-anchor-styles',
      ) as HTMLStyleElement | null
    )?.sheet;
    const painted = [...(sheet?.cssRules ?? [])].some(
      (rule) =>
        rule.cssText.includes(`comment="${uuid}"`) &&
        rule.cssText.includes('--color-secondary'),
    );
    if (!painted) return '';
    return [...document.querySelectorAll<HTMLElement>(selector)]
      .filter((el) => el.offsetParent !== null)
      .map((el) => el.textContent ?? '')
      .join('');
  }, thread);

/** The panel parameters of the current URL, decoded. */
const panelParam = (page: Page, panel: 'main' | 'right' | 'left') =>
  new URL(page.url()).searchParams.get(panel) ?? '';

/** Opens the editor with extra query parameters. */
const openWith = async (page: Page, query: Record<string, string>) => {
  const params = new URLSearchParams({ toh: TEST_WORK.toh, ...query });
  await page.goto(`/translations/editor/${TEST_WORK.uuid}?${params}`);
};

const inView = (target: Locator) =>
  expect(target).toBeInViewport({ timeout: 30_000 });

/** The open hover card. */
const hoverCard = (page: Page) => page.locator('div.z-100 > div.bg-popover');

/** A uuid, which only a (legacy) internal-link card should show. */
const UUID = '[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}';

test.describe('Navigation', () => {
  test('ED-NAV-01 Hover cards', async ({ page }) => {
    test.setTimeout(180_000);
    const targets = [
      ['2.5', '[type="glossaryInstance"]', /^g\.\d+\s*great compassion$/],
      ['1.20', '[type="endNoteLink"]', /^n\.6$/],
      ['1.12', '[type="mention"]', /^passage\s*2\.1$/],
      // Internal links are legacy: their card shows the target's uuid.
      ['p.1', '[type="internalLink"]', new RegExp(`^passage\\s*${UUID}$`)],
    ] as const;
    for (const [label, selector, text] of targets) {
      await test.step(label, async () => {
        const passage = await passageByLabel(label);
        await openEditor(page, {
          main: { tab: 'translation', hash: passage.uuid },
        });
        const target = row(page, passage.uuid).locator(selector).last();
        await settled(row(page, passage.uuid));
        for (const caret of [false, true]) {
          if (caret) await caretAtEnd(page, passage.uuid);
          await page.mouse.move(0, 0);
          await expect(hoverCard(page)).toHaveCount(0);
          await target.hover();
          await expect(hoverCard(page)).toHaveText(text);
        }
      });
    }
  });

  test('ED-NAV-02 Clicking content links', async ({ page }) => {
    const withInstance = await passageByLabel('1.20');
    const withNote = await passageByLabel('1.20');
    const note = await passageByLabel('n.6');

    await test.step('glossary instance', async () => {
      await openEditor(page, {
        main: { tab: 'translation', hash: withInstance.uuid },
      });
      await row(page, withInstance.uuid)
        .locator('[type="glossaryInstance"]')
        .click();
      await expect
        .poll(() => panelParam(page, 'right'))
        .toMatch(/^open:glossary/);
      await inView(
        page
          .locator('[data-panel="right"]')
          .getByText('great compassion', { exact: true })
          .first(),
      );
    });

    await test.step('end-note link', async () => {
      await openEditor(page, {
        main: { tab: 'translation', hash: withNote.uuid },
      });
      await row(page, withNote.uuid).locator('[type="endNoteLink"]').click();
      await expect
        .poll(() => panelParam(page, 'right'))
        .toMatch(/^open:endnotes/);
      await inView(row(page, note.uuid));
    });
  });

  for (const [kind, from, selector] of [
    ['internal link', 'p.1', 'a[type="internalLink"]'],
    ['mention', '1.12', 'a[type="mention"]'],
  ] as const) {
    test(`ED-NAV-02 Clicking an ${kind} to a passage not loaded yet`, async ({
      page,
    }) => {
      test.fixme(
        true,
        'DEV-847: following a link to a passage that is not loaded yet usually stops at the end of the loaded passages (about 1.118), so 2.1 never loads. It reaches 2.1 about one time in four, so test.fail would be flaky.',
      );
      const source = await passageByLabel(from);
      const target = await passageByLabel('2.1');
      await openEditor(page, {
        main: { tab: 'translation', hash: source.uuid },
      });
      await row(page, source.uuid).locator(selector).click();
      await expect(row(page, source.uuid)).toBeHidden();
      await expect(row(page, target.uuid)).toBeInViewport({ timeout: 10_000 });
    });
  }

  test('ED-NAV-03 Deep links', async ({ page }) => {
    const far = await passageByLabel('2.100');
    const twelve = await passageByLabel('1.12');
    const note = await passageByLabel('n.6');

    await openEditor(page, { main: { tab: 'translation', hash: far.uuid } });
    await settled(row(page, far.uuid));
    await inView(row(page, far.uuid));

    await openWith(page, {
      main: `open:translation:${twelve.uuid}`,
      start: '10',
      end: '30',
    });
    await inView(row(page, twelve.uuid));
    await expect
      .poll(() => deepLinkText(page))
      .toBe(twelve.content.slice(10, 30));

    await openWith(page, {
      right: `open:endnotes:${note.uuid}`,
      start: '5',
      end: '20',
    });
    await inView(row(page, note.uuid));
    await expect.poll(() => deepLinkText(page)).toBe(note.content.slice(5, 20));
  });

  test('ED-NAV-04 Endnote back-references', async ({ page }) => {
    test.fixme(
      true,
      'DEV-848: passage n.6 lists 1.20, but clicking the reference usually does not move the main panel. It sometimes does, so test.fail would be flaky.',
    );
    const note = await passageByLabel('n.6');
    const linking = await passageByLabel('1.20');
    await openEditor(page, { right: { tab: 'endnotes', hash: note.uuid } });
    const reference = page.locator(
      `[data-panel="right"] [data-passage-reference][data-ref-uuid="${linking.uuid}"]:visible`,
    );
    await expect(reference).toHaveText('1.20');
    await reference.click();
    await inView(row(page, linking.uuid));
  });

  /** Opens search on the current editor and waits for the results. */
  const search = async (page: Page, text: string) => {
    await page.locator('button:has(svg.lucide-search):visible').first().click();
    await page.getByPlaceholder('Type to search...').fill(text);
    await expect(page.getByRole('dialog')).toContainText(
      `Showing results for "${text}"`,
    );
  };

  /** Opens the replace panel of an open search and fills in the replacement. */
  const replaceWith = async (page: Page, text: string) => {
    await page
      .getByRole('button', { name: 'Replace', exact: true })
      .first()
      .click();
    await page.getByPlaceholder('Replace with...').fill(text);
    return page.getByRole('button', { name: 'Replace all', exact: true });
  };

  test('ED-NAV-05 Search results open their passage', async ({ page }) => {
    const prologue = await passageByLabel('p.1');
    await openEditor(page);
    await search(page, 'Vulture Peak');
    const dialog = page.getByRole('dialog');
    // Translation passages are listed as alignments; the rest under Other
    // Passages, which is where the front matter and the heading are.
    await dialog.getByRole('tab', { name: /Other Passages/ }).click();
    for (const label of ['s.1', 'i.2', 'p.1', '1.']) {
      await expect(
        dialog.getByText(label, { exact: true }).first(),
      ).toBeVisible();
    }
    await dialog.getByText('p.1', { exact: true }).first().click();
    await expect
      .poll(() => panelParam(page, 'main'))
      .toMatch(/^open:translation/);
    await inView(row(page, prologue.uuid));
  });

  test('ED-NAV-05 Replace all in front matter', async ({ page }) => {
    const prologue = await passageByLabel('p.1');
    await openEditor(page, {
      main: { tab: 'translation', hash: prologue.uuid },
    });
    await search(page, 'great saṅgha');
    await (await replaceWith(page, 'large saṅgha')).click();
    await page.keyboard.press('Escape');
    await expect(row(page, prologue.uuid)).toContainText('large saṅgha');
    // Replace writes on the server; the editor only shows the result.
    await expect(saveButton(page)).toBeHidden();
    const stored = await passageByUuid(prologue.uuid);
    expect(stored?.content).toContain('large saṅgha');
    expect(stored?.content).not.toContain('great saṅgha');
  });

  test('ED-NAV-05 Replace all in a translation passage', async ({ page }) => {
    test.fail(
      true,
      'DEV-849: translation passages come back from search as alignment matches, so Replace all stays disabled with "Every match is in the Tibetan source".',
    );
    const one = await passageByLabel('1.1');
    await openEditor(page, { main: { tab: 'translation', hash: one.uuid } });
    await search(page, 'lotus pond');
    const replaceAll = await replaceWith(page, 'lily pond');
    await expect(replaceAll).toBeEnabled({ timeout: 5_000 });
    await replaceAll.click();
    await page.keyboard.press('Escape');
    await expect(row(page, one.uuid)).toContainText('lily pond');
    expect((await passageByUuid(one.uuid))?.content).toContain('lily pond');
  });

  test('ED-NAV-06 Comments panel jumps to anchors', async ({ page }) => {
    const split = await passageByLabel('1.110');
    const unanchored = await passageByLabel('1.50');
    const threads = {
      t6: '34479689-ecd3-4945-8f02-7f5b9baa1d11',
      t5: '56c67bed-eceb-44cc-8cf8-f65e554412f5',
    };
    const card = (uuid: string) =>
      page.locator(`[data-comment-thread="${uuid}"]:visible`);
    // Cards sit beside their anchors and move while the stack settles.
    const clickCard = async (uuid: string) => {
      await expect(async () => {
        await settled(card(uuid));
        await card(uuid).click({ timeout: 5_000 });
      }).toPass({ timeout: 30_000 });
    };
    const openComments = () => tab(page, 'Comments').click();

    await test.step('a thread whose anchor crosses a mark', async () => {
      await openEditor(page, {
        main: { tab: 'translation', hash: split.uuid },
      });
      await openComments();
      await clickCard(threads.t6);
      await inView(row(page, split.uuid));
      await expect
        .poll(() => paintedAnchorText(page, threads.t6), { timeout: 30_000 })
        .toBe('perfection of wisdom');
    });

    await test.step('an unanchored thread', async () => {
      await openEditor(page, {
        main: { tab: 'translation', hash: unanchored.uuid },
      });
      await openComments();
      await expect(
        page.getByText('Unanchored', { exact: false }).first(),
      ).toBeVisible();
      await clickCard(threads.t5);
      await inView(row(page, unanchored.uuid));
    });
  });

  test('ED-NAV-06 A tagged thread outside the first page', async ({ page }) => {
    test.fixme(
      true,
      'DEV-847: the same stop at the end of the loaded passages as the ED-NAV-02 links, so 2.100 is usually never reached.',
    );
    const far = await passageByLabel('2.100');
    // The panel lists the threads on screen; filtered by a tag it lists
    // every thread in the work with that tag, which is how t3 is reached.
    await openWith(page, {
      main: 'open:translation',
      left: 'open:comments',
      commentTag: 'pending',
    });
    await tab(page, 'Comments').click();
    await page
      .locator(
        '[data-comment-thread="374f1b04-60f2-4e41-81ef-c759ec914a0d"]:visible',
      )
      .click();
    await inView(row(page, far.uuid));
    await expect
      .poll(() =>
        paintedAnchorText(page, '374f1b04-60f2-4e41-81ef-c759ec914a0d'),
      )
      .toBe('nirvāṇa');
  });

  test('ED-NAV-07 Long works: infinite scroll and scroll restore', async ({
    page,
  }) => {
    test.setTimeout(240_000);
    const expected = [
      ...(await sectionPassages('1')),
      ...(await sectionPassages('2')),
    ].map((p) => p.label);
    expect(expected).toHaveLength(281);

    await openEditor(page);
    const seen: string[] = [];
    for (let step = 0; step < 400 && seen.at(-1) !== '2.141'; step++) {
      const drawn = await page
        .locator(
          '[data-panel="main"] [data-stack-passage]:visible [data-passage-label]',
        )
        .allInnerTexts();
      for (const label of drawn) {
        if (/^\d+\.\d+$/.test(label) && !seen.includes(label)) seen.push(label);
      }
      await page.mouse.move(700, 500);
      await page.mouse.wheel(0, 600);
      await page.waitForTimeout(100);
    }
    expect(seen).toEqual(expected);

    const eighty = await passageByLabel('1.80');
    await openEditor(page, { main: { tab: 'translation', hash: eighty.uuid } });
    await settled(row(page, eighty.uuid));
    const before = await row(page, eighty.uuid).boundingBox();
    await tab(page, 'Front').click();
    await expect(row(page, eighty.uuid)).toBeHidden();
    await tab(page, 'Translation').click();
    await settled(row(page, eighty.uuid));
    const after = await row(page, eighty.uuid).boundingBox();
    expect(Math.abs((after?.y ?? 0) - (before?.y ?? 0))).toBeLessThanOrEqual(
      before?.height ?? 0,
    );
  });
});
