import type { Page } from '@playwright/test';
import {
  alignedTibetanStart,
  annotationsOf,
  coveredText,
  othersOf,
  passageByLabel,
  passageByUuid,
  workPassages,
  workSnapshot,
} from './support/db';
import {
  caretAtEnd,
  drawnLabels,
  openEditor,
  reveal,
  row,
  save,
  selectText,
  settled,
  shownLabel,
  typeAtEnd,
  type MainTab,
} from './support/editor';
import { expect, test } from './support/fixtures';
import { TEST_WORK } from './support/local-stack';

/** The Tibetan column a passage shows in Compare. */
const source = (page: Page, uuid: string) =>
  row(page, uuid).locator('[data-compare-source]');

/** Picks a Toh in the table of contents' Toh selector. */
const chooseToh = async (page: Page, toh: string) => {
  await page.getByRole('combobox').filter({ hasText: /^Toh / }).click();
  await page
    .getByRole('option', { name: `Toh ${toh.replace(/^toh/, '')}` })
    .click();
};

/** Labels of the body matter, in sort order, one per per-Toh pair. */
const bodyLabels = async () => {
  const body = /^(homage|prelude|prologue|translation|colophon|appendix)/;
  const labels = (await workPassages())
    .filter((p) => body.test(p.type))
    .map((p) => p.label);
  return labels.filter((label, i) => labels.indexOf(label) === i);
};

/**
 * Scrolls a main tab from the top to `last`, and returns every label drawn
 * on the way, in order. Fails if a label is drawn twice at once.
 */
const scrolledLabels = async (page: Page, tab: MainTab, last: string) => {
  await openEditor(page, { main: { tab } });
  const seen: string[] = [];
  for (let step = 0; step < 500 && seen.at(-1) !== last; step++) {
    const drawn = await drawnLabels(page);
    expect(new Set(drawn).size).toBe(drawn.length);
    for (const label of drawn) if (!seen.includes(label)) seen.push(label);
    await page.mouse.move(700, 500);
    await page.mouse.wheel(0, 600);
    await page.waitForTimeout(100);
  }
  return seen;
};

test.describe('Compare tab', () => {
  test('ED-CMP-01 Tibetan source column', async ({ page }) => {
    const title = await passageByLabel('t.');
    const one = await passageByLabel('1.1');
    const verse = await passageByLabel('1.2');
    const last = await passageByLabel('1.40');
    const unaligned = await passageByLabel('1.41');
    const aligned = await Promise.all(
      ['t.', '1.', '1.1', '1.2', '1.3', '1.4', '1.5'].map((l) =>
        passageByLabel(l),
      ),
    );

    for (const [toh, folio, crossing] of [
      [TEST_WORK.toh, '[F.1.a]', '[F.1.b]'],
      [TEST_WORK.otherToh, '[F.100.b]', '[F.101.a]'],
    ] as const) {
      await test.step(toh, async () => {
        if (toh === TEST_WORK.toh) {
          await openEditor(page, { main: { tab: 'compare' } });
        } else {
          await chooseToh(page, toh);
        }
        await expect(source(page, title.uuid)).toHaveText(
          new RegExp(`^${folio.replace(/[[\].]/g, '\\$&')}`),
        );
        for (const p of aligned) {
          await expect(source(page, p.uuid)).not.toBeEmpty();
        }
        await expect(source(page, one.uuid)).toContainText(
          await alignedTibetanStart(one.uuid, toh),
        );
        await expect(source(page, verse.uuid)).toContainText(crossing);
        await reveal(page, last.uuid);
        await expect(source(page, last.uuid)).toContainText(
          await alignedTibetanStart(last.uuid, toh),
        );
        await reveal(page, unaligned.uuid);
        await expect(source(page, unaligned.uuid)).toBeEmpty();
        await expect(source(page, unaligned.uuid)).toBeHidden();
      });
    }
  });

  test('ED-CMP-02 Alignment search opens Compare', async ({ page }) => {
    test.fail(
      true,
      'New bug, not filed yet: choosing a Translation Passages result opens Compare at the top, without scrolling to the passage.',
    );
    const ten = await passageByLabel('1.10');
    const phrase = (await alignedTibetanStart(ten.uuid, TEST_WORK.toh, 60))
      .slice(25)
      .trim();
    await openEditor(page);
    await page.locator('button:has(svg.lucide-search):visible').first().click();
    await page.getByPlaceholder('Type to search...').fill(phrase);
    const dialog = page.getByRole('dialog');
    await expect(dialog).toContainText(`Showing results for "${phrase}"`);
    const result = dialog
      .locator('div.cursor-pointer')
      .filter({
        has: page.locator('span.text-accent', { hasText: /^1\.10$/ }),
      });
    await expect(result).toHaveCount(1);
    await result.click();
    await expect
      .poll(() => new URL(page.url()).searchParams.get('main') ?? '')
      .toMatch(/^open:compare/);
    await expect(row(page, ten.uuid)).toBeInViewport({ timeout: 10_000 });
    await expect(source(page, ten.uuid)).toBeVisible();
    await expect(source(page, ten.uuid)).toContainText(phrase);
  });
});

test.describe('Passage types', () => {
  test('ED-TYP-01 Front tab', async ({ page }) => {
    const front = (await workPassages()).filter((p) =>
      /^(summary|acknowledgment|introduction)/.test(p.type),
    );
    expect(front.map((p) => p.sort)).toEqual([
      10, 11, 12, 20, 21, 30, 31, 32, 33, 34, 35, 36,
    ]);
    const summary = await passageByLabel('s.1');
    const seeded = await annotationsOf(summary.uuid);
    const before = await workSnapshot();

    await openEditor(page, { main: { tab: 'front' } });
    await expect
      .poll(() => drawnLabels(page))
      .toEqual(front.map((p) => p.label));
    for (const header of front.filter((p) => p.type.endsWith('Header'))) {
      await expect(row(page, header.uuid).locator('h2')).toHaveText(
        header.content,
      );
    }
    for (const body of ['h.1', '1.1']) {
      await expect(row(page, (await passageByLabel(body)).uuid)).toHaveCount(0);
    }

    await typeAtEnd(page, summary.uuid, ' Edited.');
    await save(page);

    const stored = await passageByUuid(summary.uuid);
    expect(stored?.content).toBe(`${summary.content} Edited.`);
    const shape = (a: { type: string; start: number; end: number }) =>
      `${a.type} ${a.start}-${a.end}`;
    expect((await annotationsOf(summary.uuid)).map(shape)).toEqual(
      seeded.map((a) =>
        shape(
          a.type === 'paragraph'
            ? { ...a, end: stored?.content.length ?? 0 }
            : a,
        ),
      ),
    );
    const comment = (await annotationsOf(summary.uuid)).find(
      (a) => a.type === 'comment',
    );
    expect(coveredText(stored ?? summary, comment ?? seeded[0])).toBe(
      'the six perfections',
    );
    expect(othersOf(await workSnapshot(), [summary.uuid])).toEqual(
      othersOf(before, [summary.uuid]),
    );
  });

  test('ED-TYP-02 Translation tab', async ({ page }) => {
    test.setTimeout(300_000);
    const expected = await bodyLabels();
    expect(expected.slice(0, 7)).toEqual([
      'h.',
      'h.1',
      'pl.',
      'pl.1',
      'p.',
      'p.1',
      't.',
    ]);
    expect(expected.slice(-5)).toEqual(['c.', 'c.1', 'c.2', 'ap1.', 'ap1.1']);
    expect(await scrolledLabels(page, 'translation', 'ap1.1')).toEqual(
      expected,
    );

    const appendix = await passageByLabel('ap1.1');
    const before = await workSnapshot();
    await openEditor(page, {
      main: { tab: 'translation', hash: appendix.uuid },
    });
    await typeAtEnd(page, appendix.uuid, ' Edited.');
    await save(page);
    expect((await passageByUuid(appendix.uuid))?.content).toBe(
      `${appendix.content} Edited.`,
    );
    expect(othersOf(await workSnapshot(), [appendix.uuid])).toEqual(
      othersOf(before, [appendix.uuid]),
    );
  });

  test('ED-TYP-03 Compare tab', async ({ page }) => {
    test.setTimeout(300_000);
    expect(await scrolledLabels(page, 'compare', 'ap1.1')).toEqual(
      await bodyLabels(),
    );
    const one = await passageByLabel('1.1');
    await openEditor(page, { main: { tab: 'compare', hash: one.uuid } });
    await expect(source(page, one.uuid)).toBeVisible();
  });

  test('ED-TYP-04 Endnotes tab', async ({ page }) => {
    const notes = ['n.', ...Array.from({ length: 13 }, (_, i) => `n.${i + 1}`)];
    const variants = {
      [TEST_WORK.toh]: await passageByLabel('n.5', TEST_WORK.toh),
      [TEST_WORK.otherToh]: await passageByLabel('n.5', TEST_WORK.otherToh),
    };
    expect(variants[TEST_WORK.toh].content).toBe(
      'In Toh 90001 the verse ends with the image of the lotus.',
    );
    expect(variants[TEST_WORK.otherToh].content).toBe(
      'In Toh 90002 the verse ends instead with the moon reflected in water.',
    );

    for (const [toh, other] of [
      [TEST_WORK.toh, TEST_WORK.otherToh],
      [TEST_WORK.otherToh, TEST_WORK.toh],
    ]) {
      await openEditor(page, { right: { tab: 'endnotes' }, toh });
      await expect.poll(() => drawnLabels(page, 'right')).toEqual(notes);
      await expect(row(page, variants[toh].uuid)).toContainText(
        variants[toh].content,
      );
      await expect(row(page, variants[other].uuid)).toHaveCount(0);
    }

    const nine = await passageByLabel('n.9');
    const before = await workSnapshot();
    await openEditor(page, { right: { tab: 'endnotes', hash: nine.uuid } });
    await typeAtEnd(page, nine.uuid, ' Edited.');
    await save(page);
    expect((await passageByUuid(nine.uuid))?.content).toBe(
      `${nine.content} Edited.`,
    );
    expect(othersOf(await workSnapshot(), [nine.uuid])).toEqual(
      othersOf(before, [nine.uuid]),
    );
  });

  test('ED-TYP-05 Abbreviations tab', async ({ page }) => {
    const entries = (await workPassages()).filter(
      (p) => p.type === 'abbreviations',
    );
    expect(entries.map((p) => p.content.split(' ')[0])).toEqual([
      'D',
      'H',
      'K',
      'S',
      'Toh',
    ]);
    const degé = entries[0];
    const seeded = await annotationsOf(degé.uuid);
    const before = await workSnapshot();

    await openEditor(page, { right: { tab: 'abbreviations' } });
    for (const [i, entry] of entries.entries()) {
      const shown = row(page, entry.uuid);
      await expect(shown).toHaveText(entry.content);
      const rows = page.locator(
        '[data-panel="right"] [data-stack-passage]:visible',
      );
      await expect(rows.nth(i + 1)).toHaveAttribute(
        'data-stack-passage',
        entry.uuid,
      );
    }
    const style = (type: string) =>
      row(page, degé.uuid)
        .locator(`[type="${type}"]`)
        .evaluate((el) => getComputedStyle(el).fontStyle);
    expect(await style('abbreviation')).not.toBe(
      await style('hasAbbreviation'),
    );

    await typeAtEnd(page, degé.uuid, ' (edited)');
    await save(page);

    const stored = await passageByUuid(degé.uuid);
    expect(stored?.content).toBe('D Degé Kangyur (edited)');
    const covered = (
      type: string,
      from: { content: string },
      list: typeof seeded,
    ) => list.filter((a) => a.type === type).map((a) => coveredText(from, a));
    const after = await annotationsOf(degé.uuid);
    expect(covered('abbreviation', stored ?? degé, after)).toEqual(
      covered('abbreviation', degé, seeded),
    );
    expect(covered('has-abbreviation', stored ?? degé, after)).toEqual([
      'Degé Kangyur (edited)',
    ]);
    expect(othersOf(await workSnapshot(), [degé.uuid])).toEqual(
      othersOf(before, [degé.uuid]),
    );
  });
});

test.describe('Endnote labels', () => {
  test('ED-STR-06 Endnote labels across Toh variants', async ({ page }) => {
    const one = await passageByLabel('1.1');
    const variants = [
      await passageByLabel('n.5', TEST_WORK.toh),
      await passageByLabel('n.5', TEST_WORK.otherToh),
    ];

    await openEditor(page, { main: { tab: 'translation', hash: one.uuid } });
    await selectText(page, one.uuid, 'lotus pond');
    await page.locator('button:has(svg.lucide-asterisk):visible').click();
    await page.getByRole('button', { name: 'Create new endnote' }).click();
    await expect(shownLabel(page, variants[0].uuid)).toHaveText('n.6');
    await caretAtEnd(page, one.uuid);
    await save(page);

    const stored = await Promise.all(
      variants.map((v) => passageByUuid(v.uuid)),
    );
    expect(stored.map((p) => p?.label)).toEqual(['n.6', 'n.6']);
    expect(stored[0]?.sort).toBe(stored[1]?.sort);

    for (const variant of variants) {
      await openEditor(page, {
        right: { tab: 'endnotes', hash: variant.uuid },
        toh: variant.toh ?? TEST_WORK.toh,
      });
      await settled(row(page, variant.uuid));
      await expect(shownLabel(page, variant.uuid)).toHaveText('n.6');
    }
  });
});
