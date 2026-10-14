import type { Page } from '@playwright/test';
import {
  annotationsOf,
  coveredText,
  db,
  othersOf,
  passageByLabel,
  passageByUuid,
  workPassages,
  workSnapshot,
  type StoredAnnotation,
} from './support/db';
import {
  bubbleMenu,
  caretAtEnd,
  drawnLabels,
  openEditor,
  row,
  save,
  saveButton,
  selectText,
  settled,
  shownLabel,
  slashCommand,
  tab,
  typeAtEnd,
  undo,
  type RightTab,
} from './support/editor';
import { expect, test } from './support/fixtures';
import { restoreTestWork, TEST_WORK } from './support/local-stack';

const openAt = (page: Page, uuid: string, right?: RightTab) =>
  openEditor(page, {
    main: { tab: 'translation', hash: uuid },
    right: right && { tab: right },
  });

const ofType = async (uuid: string, type: string) =>
  (await annotationsOf(uuid)).filter((a) => a.type === type);

/** Whether an annotation's content names this uuid. */
const names = (a: StoredAnnotation | undefined, uuid: string) =>
  JSON.stringify(a?.content ?? null).includes(uuid);

const bubbleButton = (page: Page, icon: string) =>
  bubbleMenu(page).locator(`button:has(svg.lucide-${icon})`);

/** A search result whose accent label is exactly `label`. */
const result = (page: Page, label: string | RegExp) =>
  page
    .locator('div.cursor-pointer, button')
    .filter({ has: page.locator('span.text-accent', { hasText: label }) })
    .filter({ visible: true })
    .first();

/** Saves when there are unsaved changes. */
const saveIfDirty = async (page: Page) => {
  if (await saveButton(page).isVisible()) await save(page);
};

/** Picks a Toh in the table of contents' Toh selector. */
const chooseToh = async (page: Page, toh: string) => {
  await page.getByRole('combobox').filter({ hasText: /^Toh / }).click();
  await page
    .getByRole('option', { name: `Toh ${toh.replace(/^toh/, '')}` })
    .click();
};

/** The open hover card. */
const hoverCard = (page: Page) => page.locator('div.z-100 > div.bg-popover');

const GREAT_COMPASSION = '8c143eaa-317c-4947-8bf2-a4e887e8f534';

test.describe('Annotations', () => {
  test('ED-ANN-01 Glossary instance: add', async ({ page }) => {
    const one = await passageByLabel('1.1');
    const seeded = await annotationsOf(one.uuid);
    const before = await workSnapshot();

    await openAt(page, one.uuid);
    await selectText(page, one.uuid, 'great compassion');
    await bubbleButton(page, 'book-open-text').click();
    await bubbleMenu(page)
      .locator('button')
      .filter({
        has: page.locator('span.font-medium', {
          hasText: /^great compassion$/,
        }),
      })
      .click();
    const instance = row(page, one.uuid).locator('[type="glossaryInstance"]');
    await expect(instance).toHaveText('great compassion');
    await save(page);
    await instance.hover();
    await expect(hoverCard(page)).toContainText('great compassion');

    const after = await annotationsOf(one.uuid);
    const added = after.filter((a) => !seeded.some((s) => s.uuid === a.uuid));
    expect(added.map((a) => [a.type, coveredText(one, a)])).toEqual([
      ['glossary-instance', 'great compassion'],
    ]);
    expect((added[0].content as { uuid?: string }[])[0]?.uuid ?? '').toBe(
      GREAT_COMPASSION,
    );
    expect(after.filter((a) => a !== added[0])).toEqual(seeded);
    expect(othersOf(await workSnapshot(), [one.uuid])).toEqual(
      othersOf(before, [one.uuid]),
    );
  });

  test('ED-ANN-02 Glossary instance: remove', async ({ page }) => {
    const five = await passageByLabel('2.5');
    const kept = (await annotationsOf(five.uuid)).filter(
      (a) => a.type !== 'glossary-instance',
    );
    await openAt(page, five.uuid);
    const instance = row(page, five.uuid).locator('[type="glossaryInstance"]');
    await settled(row(page, five.uuid));
    await instance.hover();
    await hoverCard(page).locator('button:has(svg.lucide-trash-2)').click();
    await expect(instance).toHaveCount(0);
    await expect(row(page, five.uuid).locator('[type="mention"]')).toHaveText(
      'bodhisattva',
    );
    await save(page);
    expect(await annotationsOf(five.uuid)).toEqual(kept);
  });

  test('ED-ANN-03 Mention', async ({ page }) => {
    const four = await passageByLabel('1.4');
    const target = await passageByLabel('2.1');
    const mention = row(page, four.uuid).locator('a[type="mention"]');

    const entryPoints: [string, () => Promise<void>][] = [
      [
        'bubble menu',
        async () => {
          await typeAtEnd(page, four.uuid, ' 2.1');
          await selectText(page, four.uuid, '2.1');
          await bubbleButton(page, 'at-sign').click();
        },
      ],
      [
        'slash command',
        async () => {
          await typeAtEnd(page, four.uuid, ' ');
          await slashCommand(page, 'mention', 'Mention');
          await page.keyboard.type('2.1');
        },
      ],
      [
        'advanced overlay',
        async () => {
          await typeAtEnd(page, four.uuid, ' @2.1');
          await page.getByText('Advanced search…').click();
        },
      ],
    ];
    for (const [name, insert] of entryPoints) {
      await test.step(name, async () => {
        restoreTestWork();
        await openAt(page, four.uuid);
        await insert();
        await result(page, /^2\.1$/).click();
        await expect(mention).toHaveCount(1);
        await save(page);
        // The trigger characters need a space before them.
        const content = `${four.content} `;
        expect((await passageByUuid(four.uuid))?.content).toBe(content);
        const mentions = await ofType(four.uuid, 'mention');
        expect(mentions.map((a) => [a.start, a.end])).toEqual([
          [content.length, content.length],
        ]);
        expect(names(mentions[0], target.uuid)).toBe(true);
      });
    }
  });

  test('ED-ANN-04 External link', async ({ page }) => {
    const four = await passageByLabel('1.4');

    await openAt(page, four.uuid);
    await selectText(page, four.uuid, 'dependent arising');
    await bubbleButton(page, 'link').click();
    await page.getByPlaceholder('Add link...').fill('https://example.org/');
    await page.getByPlaceholder('Add link...').press('Enter');
    await save(page);
    const [link] = await ofType(four.uuid, 'link');
    expect(coveredText(four, link)).toBe('dependent arising');
    expect(JSON.stringify(link.content)).toContain('"https://example.org/"');
  });

  test('ED-ANN-04 Internal link', async ({ page }) => {
    const prelude = await passageByLabel('p.1');
    const twelve = await passageByLabel('1.12');
    await openAt(page, prelude.uuid);
    const internal = row(page, prelude.uuid).locator('a[type="internalLink"]');
    await settled(row(page, prelude.uuid));
    await internal.hover();
    await hoverCard(page).locator('button:has(svg.lucide-pencil)').click();
    await page.getByPlaceholder('Entity uuid...').fill(twelve.uuid);
    await page.getByPlaceholder('Entity uuid...').press('Enter');
    await save(page);
    const [stored] = await ofType(prelude.uuid, 'internal-link');
    expect(coveredText(prelude, stored)).toBe('Mañjuśrī rises to speak');
    expect(names(stored, twelve.uuid)).toBe(true);
  });

  test('ED-ANN-05 Endnote link', async ({ page }) => {
    const one = await passageByLabel('1.1');
    const [two, three] = await Promise.all(
      ['n.2', 'n.3'].map((l) => passageByLabel(l)),
    );
    const fives = await Promise.all(
      [TEST_WORK.toh, TEST_WORK.otherToh].map((t) => passageByLabel('n.5', t)),
    );
    const seededLabels = [
      'n.',
      ...Array.from({ length: 13 }, (_, i) => `n.${i + 1}`),
    ];
    const end = one.content.length;
    const insert = async () => {
      await openAt(page, one.uuid, 'endnotes');
      await expect.poll(() => drawnLabels(page, 'right')).toEqual(seededLabels);
      await selectText(page, one.uuid, 'compassion.”');
      await bubbleButton(page, 'asterisk').click();
      await page.getByRole('button', { name: 'Create new endnote' }).click();
    };

    await insert();
    const marker = row(page, one.uuid).locator('[type="endNoteLink"]');
    await expect(marker).toHaveCount(1);
    await expect
      .poll(() => drawnLabels(page, 'right'))
      .toEqual([...seededLabels, 'n.14']);
    await expect(shownLabel(page, three.uuid)).toHaveText('n.4');
    await expect(shownLabel(page, fives[0].uuid)).toHaveText('n.6');
    const added = await page
      .locator('[data-panel="right"] [data-stack-passage]:visible')
      .nth(3)
      .getAttribute('data-stack-passage');
    await expect(shownLabel(page, added ?? '')).toHaveText('n.3');
    await typeAtEnd(page, added ?? '', 'A new note.');
    await save(page);

    const note = await passageByUuid(added ?? '');
    expect(note).toMatchObject({ content: 'A new note.', label: 'n.3' });
    expect(note?.sort).toBeGreaterThan(two.sort);
    const moved = await passageByUuid(three.uuid);
    expect(note?.sort).toBeLessThan(moved?.sort ?? 0);
    expect(moved?.label).toBe('n.4');
    for (const five of fives) {
      expect((await passageByUuid(five.uuid))?.label).toBe('n.6');
    }
    const links = await ofType(one.uuid, 'end-note-link');
    expect(links.map((a) => [a.start, a.end])).toEqual([[end, end]]);
    expect(names(links[0], added ?? '')).toBe(true);

    await test.step('undo', async () => {
      restoreTestWork();
      const before = await workSnapshot();
      await insert();
      await expect(marker).toHaveCount(1);
      await undo(page);
      await expect(marker).toHaveCount(0);
      await expect.poll(() => drawnLabels(page, 'right')).toEqual(seededLabels);
      await saveIfDirty(page);
      expect(await workSnapshot()).toEqual(before);
    });
  });

  test('ED-ANN-06 Comments', async ({ page }) => {
    const twelve = await passageByLabel('1.12');
    const card = (uuid: string) =>
      page.locator(`[data-comment-thread="${uuid}"]:visible`);
    const threadsOn = async () => {
      const { data } = await db()
        .from('comments')
        .select('uuid, parent_uuid, content, tags')
        .eq('entity_uuid', twelve.uuid);
      return data ?? [];
    };

    await openAt(page, twelve.uuid);
    await selectText(page, twelve.uuid, 'Mañjuśrī explained');
    await page.getByRole('button', { name: 'Comment on selection' }).click();
    await page.getByPlaceholder('Add a comment…').fill('Check this.');
    await page.getByRole('button', { name: 'Comment', exact: true }).click();
    await expect.poll(async () => (await threadsOn()).length).toBe(1);
    const [comment] = await threadsOn();
    expect(comment.parent_uuid).toBeNull();
    expect(comment.content).toContain('Check this.');
    await expect(card(comment.uuid)).toBeVisible();
    await expect(
      row(page, twelve.uuid).locator(
        `span[type="comment"][comment="${comment.uuid}"]`,
      ),
    ).toHaveText('Mañjuśrī explained');
    await save(page);
    const anchors = await ofType(twelve.uuid, 'comment');
    expect(anchors.map((a) => coveredText(twelve, a))).toEqual([
      'Mañjuśrī explained',
    ]);
    expect(names(anchors[0], comment.uuid)).toBe(true);

    await card(comment.uuid).getByRole('button', { name: '+ Tag' }).click();
    await page.getByLabel('New tag').fill('pending');
    await page.getByLabel('New tag').press('Enter');
    await expect
      .poll(async () => (await threadsOn())[0]?.tags)
      .toEqual(['pending']);
    await page.goto(
      `/translations/editor/${TEST_WORK.uuid}?${new URLSearchParams({
        toh: TEST_WORK.toh,
        main: 'open:translation',
        left: 'open:comments',
        commentTag: 'pending',
      })}`,
    );
    await tab(page, 'Comments').click();
    for (const uuid of [
      '374f1b04-60f2-4e41-81ef-c759ec914a0d',
      '83268921-d8bd-4f2e-8af3-19e6d0d42514',
      comment.uuid,
    ]) {
      await expect(card(uuid)).toBeVisible();
    }

    await openAt(page, twelve.uuid);
    await tab(page, 'Comments').click();
    await expect(async () => {
      await card(comment.uuid)
        .getByRole('button', { name: 'Delete', exact: true })
        .click({ timeout: 2_000 });
      await card(comment.uuid)
        .getByRole('button', { name: 'Confirm' })
        .click({ timeout: 2_000 });
    }).toPass({ timeout: 30_000 });
    await expect(card(comment.uuid)).toHaveCount(0);
    await saveIfDirty(page);
    expect(await threadsOn()).toEqual([]);
    expect(await ofType(twelve.uuid, 'comment')).toEqual([]);
  });

  test('ED-ANN-07 Abbreviation and has-abbreviation', async ({ page }) => {
    const entries = (await workPassages()).filter(
      (p) => p.type === 'abbreviations',
    );
    const toh = entries[entries.length - 1];
    await openEditor(page, { right: { tab: 'abbreviations' } });
    await caretAtEnd(page, toh.uuid);
    await page.keyboard.press('Enter');
    await slashCommand(page, 'passage', 'Passage');
    await slashCommand(page, 'abbr', 'Abbreviation');
    const rows = page.locator(
      '[data-panel="right"] [data-stack-passage]:visible',
    );
    await expect(rows).toHaveCount(entries.length + 2);
    const uuid = (await rows.last().getAttribute('data-stack-passage')) ?? '';
    await expect(row(page, uuid).locator('[type="abbreviation"]')).toHaveText(
      'A',
    );
    await expect(
      row(page, uuid).locator('[type="hasAbbreviation"]'),
    ).toHaveText('Abbreviation');
    await save(page);

    const covered = async () => {
      const stored = await passageByUuid(uuid);
      return Promise.all(
        ['abbreviation', 'has-abbreviation'].map(async (type) =>
          (await ofType(uuid, type)).map((a) => coveredText(stored ?? toh, a)),
        ),
      );
    };
    const added = await passageByUuid(uuid);
    expect(added?.type).toBe('abbreviations');
    expect(added?.sort).toBeGreaterThan(toh.sort);
    expect(await covered()).toEqual([['A'], ['Abbreviation']]);

    await selectText(page, uuid, 'Abbreviation');
    await page.keyboard.type('Zeta Kangyur');
    await selectText(page, uuid, 'A');
    await page.keyboard.type('Z');
    await save(page);
    expect(await covered()).toEqual([['Z'], ['Zeta Kangyur']]);
  });

  test('ED-ANN-08 Toh-scoped annotations', async ({ page }) => {
    const five = await passageByLabel('1.5');
    const title = await passageByLabel('t.');
    const notes = await Promise.all(
      [TEST_WORK.toh, TEST_WORK.otherToh].map((t) => passageByLabel('n.5', t)),
    );
    const seeded = await annotationsOf(five.uuid);
    const scoped = (list: StoredAnnotation[]) =>
      list
        .filter((a) => a.toh)
        .map((a) => [a.type, a.toh, JSON.stringify(a.content)].join(' '))
        .sort();
    const heading = (toh: string) =>
      row(page, title.uuid).getByText(`(Toh ${toh})`);
    const emphasis = row(page, five.uuid).locator(
      '[data-text-style="emphasis"]',
    );

    await openEditor(page, {
      main: { tab: 'translation', hash: five.uuid },
      right: { tab: 'endnotes', hash: notes[0].uuid },
    });
    await expect(emphasis).toHaveText('not stained');
    await expect(emphasis).toBeVisible();
    await expect(heading('90001')).toBeVisible();
    await expect(heading('90002')).toBeHidden();
    await expect(row(page, notes[0].uuid)).toContainText('image of the lotus.');

    await chooseToh(page, TEST_WORK.otherToh);
    await expect(heading('90002')).toBeVisible();
    await expect(heading('90001')).toBeHidden();
    await expect(emphasis).toBeHidden();
    await expect(row(page, notes[1].uuid)).toContainText(
      'moon reflected in water.',
    );

    await selectText(page, five.uuid, 'mud');
    await page.keyboard.type('mire');
    await save(page);
    expect((await passageByUuid(five.uuid))?.content).toContain('mire');
    expect(scoped(await annotationsOf(five.uuid))).toEqual(scoped(seeded));
  });
});
