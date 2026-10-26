import type { Page } from '@playwright/test';
import {
  annotationsOf,
  passageByLabel,
  passageByUuid,
  sectionPassages,
  workPassages,
  type StoredPassage,
} from './support/db';
import {
  caretAtEnd,
  caretAtStart,
  labelMenuItem,
  openLabelMenu,
  openEditor,
  pointAt,
  redo,
  reveal,
  row,
  save,
  saveButton,
  shownLabel,
  slashCommand,
  typeAtEnd,
  undo,
  isSaveRequest,
} from './support/editor';
import { expect, test } from './support/fixtures';
import { restoreTestWork } from './support/local-stack';

/** `1.1`, `1.2`, … in sort order, with no gap and no repeat. */
const expectContiguous = (passages: StoredPassage[], prefix = '1') =>
  expect(passages.map((p) => p.label)).toEqual(
    passages.map((_, i) => `${prefix}.${i + 1}`),
  );

/** Uuid and label of each passage in chapter 2, which no test here touches. */
const chapterTwo = async () =>
  (await sectionPassages('2')).map(({ uuid, label, sort }) => ({
    uuid,
    label,
    sort,
  }));

const openAt = (page: Page, uuid: string) =>
  openEditor(page, { main: { tab: 'translation', hash: uuid } });

/** Saves, then reloads the editor at the passage, to read what was stored. */
const saveAndReload = async (page: Page, uuid: string) => {
  await save(page);
  await openAt(page, uuid);
};

test.describe('Passage structure', () => {
  test('ED-STR-01 New passage from the slash menu, saved (ED-SAV-03)', async ({
    page,
  }) => {
    const before = await sectionPassages('1');
    const twelve = await passageByLabel('1.12');
    const oldThirteen = await passageByLabel('1.13');
    const two = await chapterTwo();

    await openAt(page, twelve.uuid);
    await caretAtEnd(page, twelve.uuid);
    await page.keyboard.press('Enter');
    await slashCommand(page, 'passage', 'Passage');
    await page.keyboard.type('A new passage.');
    await expect(shownLabel(page, oldThirteen.uuid)).toHaveText('1.14');
    await save(page);

    const after = await sectionPassages('1');
    expect(after).toHaveLength(before.length + 1);
    expectContiguous(after);
    const added = after.find((p) => !before.some((b) => b.uuid === p.uuid));
    expect(added?.content).toBe('A new passage.');
    expect(added?.label).toBe('1.13');
    const order = after.map((p) => p.uuid);
    expect(order.indexOf(added?.uuid ?? '')).toBe(
      order.indexOf(twelve.uuid) + 1,
    );
    expect(after.at(-1)?.label).toBe(`1.${before.length + 1}`);
    expect(new Set(after.map((p) => p.sort)).size).toBe(after.length);
    expect(await chapterTwo()).toEqual(two);

    await openAt(page, added?.uuid ?? '');
    await expect(row(page, added?.uuid ?? '')).toContainText('A new passage.');
    await expect(shownLabel(page, added?.uuid ?? '')).toHaveText('1.13');
  });

  test('ED-STR-02 New passage with Enter twice', async ({ page }) => {
    test.fail(
      true,
      'DEV-842: at the end of a line group the text typed after two Enters lands in a new line of 1.2, and no passage is stored.',
    );
    const verse = await passageByLabel('1.2');
    const seeded = await annotationsOf(verse.uuid);
    expect(seeded).toHaveLength(7);
    const before = await sectionPassages('1');

    await openAt(page, verse.uuid);
    await caretAtEnd(page, verse.uuid);
    await page.keyboard.press('Enter');
    await page.keyboard.press('Enter');
    await page.keyboard.type('After the verse.');
    await save(page);

    const after = await sectionPassages('1');
    expectContiguous(after);
    const added = after.find((p) => !before.some((b) => b.uuid === p.uuid));
    expect(added).toMatchObject({ label: '1.3', content: 'After the verse.' });
    const kept = (await annotationsOf(verse.uuid)).map((a) => a.uuid);
    expect(kept).toEqual(expect.arrayContaining(seeded.map((a) => a.uuid)));
    const moved = (await annotationsOf(added?.uuid ?? '')).map((a) => a.uuid);
    expect(moved.length).toBeGreaterThan(0);
    expect(moved.filter((uuid) => kept.includes(uuid))).toEqual([]);
  });

  test('ED-STR-03 Merge with Backspace', async ({ page }) => {
    const head = await passageByLabel('1.20');
    const tail = await passageByLabel('1.21');
    const headAnnotations = await annotationsOf(head.uuid);
    const tailAnnotations = await annotationsOf(tail.uuid);
    const before = await sectionPassages('1');
    const two = await chapterTwo();

    await openAt(page, head.uuid);
    await reveal(page, tail.uuid);
    await caretAtStart(page, tail.uuid);
    await page.keyboard.press('Backspace');
    // Not the old row going away: it sometimes stays on screen.
    await expect(row(page, head.uuid)).toContainText(tail.content.slice(0, 20));
    await save(page);

    expect(await passageByUuid(tail.uuid)).toBeNull();
    const merged = await passageByUuid(head.uuid);
    expect(merged?.content).toBe(head.content + tail.content);
    const after = await sectionPassages('1');
    expect(after).toHaveLength(before.length - 1);
    expectContiguous(after);
    expect(await chapterTwo()).toEqual(two);

    const shape = (a: { type: string; start: number; end: number }) =>
      `${a.type} ${a.start}-${a.end}`;
    const stored = (await annotationsOf(head.uuid)).map(shape);
    const kept = headAnnotations
      .filter((a) => a.type !== 'paragraph')
      .map(shape);
    const shifted = tailAnnotations
      .filter((a) => a.type !== 'paragraph')
      .map((a) =>
        shape({
          ...a,
          start: a.start + head.content.length,
          end: a.end + head.content.length,
        }),
      );
    expect(stored).toEqual(expect.arrayContaining([...kept, ...shifted]));
  });

  test('ED-STR-03 Merge with Backspace: the view stays on the merged passage', async ({
    page,
  }) => {
    test.fixme(
      true,
      'DEV-853: the view usually moves away from the merged passage, and the old row sometimes stays on screen. Both are intermittent, so test.fail would be flaky.',
    );
    const head = await passageByLabel('1.20');
    const tail = await passageByLabel('1.21');
    await openAt(page, head.uuid);
    await reveal(page, tail.uuid);
    await caretAtStart(page, tail.uuid);
    await page.keyboard.press('Backspace');
    await expect(row(page, tail.uuid)).toHaveCount(0);
    await expect(row(page, head.uuid)).toBeInViewport();
  });

  test('ED-STR-04 Passage label menu', async ({ page, browserName }) => {
    const twelve = await passageByLabel('1.12');
    const thirteen = await passageByLabel('1.13');

    await test.step('menu items', async () => {
      await openAt(page, twelve.uuid);
      await expect(async () => {
        await openLabelMenu(page, twelve.uuid);
        await expect(page.getByRole('menuitem')).toHaveText(
          ['Copy Link', 'Edit Label', 'View Attributes', 'Delete'],
          { timeout: 2_000 },
        );
      }).toPass({ timeout: 30_000 });
      await page.keyboard.press('Escape');
    });

    if (browserName === 'chromium') {
      await test.step('Copy Link', async () => {
        await labelMenuItem(page, twelve.uuid, 'Copy Link');
        const link = await page.evaluate(() => navigator.clipboard.readText());
        await page.goto(link);
        await expect(row(page, twelve.uuid)).toBeInViewport({
          timeout: 60_000,
        });
      });
    }

    await test.step('View Attributes', async () => {
      await openAt(page, twelve.uuid);
      await labelMenuItem(page, twelve.uuid, 'View Attributes');
      const dialog = page.getByRole('dialog');
      await expect(dialog).toContainText(twelve.uuid);
      await expect(dialog).toContainText('1.12');
      await expect(dialog).toContainText('translation');
      await page.keyboard.press('Escape');
    });

    await test.step('Delete', async () => {
      restoreTestWork();
      await openAt(page, twelve.uuid);
      await labelMenuItem(page, twelve.uuid, 'Delete');
      await page.getByRole('button', { name: 'Delete', exact: true }).click();
      await saveAndReload(page, thirteen.uuid);
      await expect(shownLabel(page, thirteen.uuid)).toHaveText('1.12');
      await expect(row(page, twelve.uuid)).toHaveCount(0);
      expect(await passageByUuid(twelve.uuid)).toBeNull();
      expect(await annotationsOf(twelve.uuid)).toEqual([]);
      expectContiguous(await sectionPassages('1'));
    });
  });

  test('ED-STR-04 Passage label menu: an edited label is saved', async ({
    page,
  }) => {
    const twelve = await passageByLabel('1.12');
    await openAt(page, twelve.uuid);
    await labelMenuItem(page, twelve.uuid, 'Edit Label');
    await page.getByPlaceholder('X.X').fill('1.12a');
    await page
      .getByRole('dialog')
      .getByRole('button', { name: 'Save', exact: true })
      .click();
    await expect(shownLabel(page, twelve.uuid)).toHaveText('1.12a');
    await expect(saveButton(page)).toBeVisible();
    await save(page);
    expect((await passageByUuid(twelve.uuid))?.label).toBe('1.12a');
  });

  test('ED-STR-05 Labels renumber', async ({ page }) => {
    const sorts = async () =>
      Object.fromEntries((await workPassages()).map((p) => [p.uuid, p.sort]));
    const before = await sorts();
    const edited = await passageByLabel('1.4');

    await openAt(page, edited.uuid);
    await typeAtEnd(page, edited.uuid, 'Q');
    await save(page);
    expect(await sorts()).toEqual(before);

    const deleted = await passageByLabel('1.30');
    const order = (await sectionPassages('1')).map((p) => p.uuid);
    await openAt(page, deleted.uuid);
    await labelMenuItem(page, deleted.uuid, 'Delete');
    await page.getByRole('button', { name: 'Delete', exact: true }).click();
    await save(page);
    const after = await sectionPassages('1');
    expectContiguous(after);
    expect(after.map((p) => p.uuid)).toEqual(
      order.filter((uuid) => uuid !== deleted.uuid),
    );
  });
});

test.describe('Editing', () => {
  // Undo may or may not leave the Save button up, and a save with nothing
  // to write shows no toast and may send nothing. Wait for its request to
  // be answered when there is one: keys pressed while it is in flight are
  // lost.
  const saveIfShown = async (page: Page) => {
    if (!(await saveButton(page).isVisible())) return;
    const sent = page
      .waitForResponse((r) => isSaveRequest(r.request()), { timeout: 5_000 })
      .then(
        () => undefined,
        () => undefined,
      );
    await saveButton(page).click();
    await expect(saveButton(page)).toBeHidden();
    await sent;
  };

  test('ED-EDT-01 Undo and redo across passages', async ({ page }) => {
    const eleven = await passageByLabel('1.11');
    const twelve = await passageByLabel('1.12');
    const thirteen = await passageByLabel('1.13');
    const seeded = JSON.stringify(await workPassages());
    const unchanged = async () =>
      expect(JSON.stringify(await workPassages())).toBe(seeded);

    await test.step('typing', async () => {
      await openAt(page, eleven.uuid);
      await typeAtEnd(page, eleven.uuid, 'X');
      await typeAtEnd(page, twelve.uuid, 'Y');
      await undo(page);
      await undo(page);
      await expect(row(page, eleven.uuid)).toHaveText(
        new RegExp(`${eleven.content.slice(-10)}$`),
      );
      await saveIfShown(page);
      await unchanged();
      await redo(page);
      await redo(page);
      await save(page);
      expect((await passageByUuid(eleven.uuid))?.content).toBe(
        `${eleven.content}X`,
      );
      expect((await passageByUuid(twelve.uuid))?.content).toBe(
        `${twelve.content}Y`,
      );
    });

    await test.step('split', async () => {
      restoreTestWork();
      await openAt(page, twelve.uuid);
      await caretAtEnd(page, twelve.uuid);
      await page.keyboard.press('Enter');
      await page.keyboard.press('Enter');
      await undo(page);
      await saveIfShown(page);
      await unchanged();
    });

    await test.step('merge', async () => {
      restoreTestWork();
      await openAt(page, twelve.uuid);
      await caretAtStart(page, thirteen.uuid);
      await page.keyboard.press('Backspace');
      await undo(page);
      await saveIfShown(page);
      await unchanged();
    });
  });

  test('ED-EDT-01 Undo and redo across passages: undo a delete', async ({
    page,
  }) => {
    test.fixme(
      true,
      'DEV-852: about 1 run in 5, after Delete, undo and Save, 1.12 is still shown but its annotations are stored empty. It passes the rest of the time, so test.fail would be flaky.',
    );
    const twelve = await passageByLabel('1.12');
    const annotations = await annotationsOf(twelve.uuid);
    await openAt(page, twelve.uuid);
    await labelMenuItem(page, twelve.uuid, 'Delete');
    await page.getByRole('button', { name: 'Delete', exact: true }).click();
    await undo(page);
    await saveIfShown(page);
    await openAt(page, twelve.uuid);
    await expect(row(page, twelve.uuid)).toBeVisible();
    expect(await annotationsOf(twelve.uuid)).toEqual(annotations);
  });

  test('ED-EDT-03 Select and delete across passages', async ({ page }) => {
    const eleven = await passageByLabel('1.11');
    const twelve = await passageByLabel('1.12');
    const thirteen = await passageByLabel('1.13');
    const before = await sectionPassages('1');

    await openAt(page, eleven.uuid);
    await caretAtEnd(page, eleven.uuid);
    const from = await pointAt(page, eleven.uuid, 'recited aloud', 'end');
    const to = await pointAt(page, twelve.uuid, 'is used here', 'start');
    await page.mouse.move(from.x, from.y);
    await page.mouse.down();
    await page.mouse.move(to.x, to.y, { steps: 10 });
    await page.mouse.up();
    await page.keyboard.press('Delete');
    await expect(row(page, eleven.uuid)).toHaveCount(0);
    await expect(row(page, twelve.uuid)).toHaveCount(0);
    await expect(shownLabel(page, thirteen.uuid)).toHaveText('1.11');
    await save(page);

    expect(await passageByUuid(eleven.uuid)).toBeNull();
    expect(await passageByUuid(twelve.uuid)).toBeNull();
    expect(await annotationsOf(eleven.uuid)).toEqual([]);
    const after = await sectionPassages('1');
    expect(after).toHaveLength(before.length - 2);
    expectContiguous(after);
  });
});
