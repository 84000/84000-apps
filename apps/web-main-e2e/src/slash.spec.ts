import type { Page } from '@playwright/test';
import {
  annotationsOf,
  coveredText,
  passageByLabel,
  passageByUuid,
  type StoredPassage,
} from './support/db';
import {
  caretAtEnd,
  openEditor,
  save,
  slashCommand,
  slashMenuItems,
} from './support/editor';
import { expect, test } from './support/fixtures';
import { restoreTestWork } from './support/local-stack';

/** Opens 1.12 with the caret on a new empty paragraph at its end. */
const fresh = async (page: Page, uuid: string) => {
  await openEditor(page, { main: { tab: 'translation', hash: uuid } });
  await caretAtEnd(page, uuid);
  await page.keyboard.press('Enter');
};

/** Picks a slash item, types into the block, saves, and checks the rows. */
const insertAndCheck = async (
  page: Page,
  twelve: StoredPassage,
  [query, item, expected]: readonly [string, string, readonly string[]],
) => {
  await fresh(page, twelve.uuid);
  await slashCommand(page, query, item);
  await page.keyboard.type('Slash entry.');
  await save(page);
  const stored = await passageByUuid(twelve.uuid);
  expect(stored?.content).toBe(`${twelve.content}Slash entry.`);
  const blocks = (await annotationsOf(twelve.uuid))
    .filter((a) => coveredText(stored ?? twelve, a) === 'Slash entry.')
    .map((a) => {
      const level = JSON.stringify(a.content).match(/"(h\d)"/);
      return level ? `${a.type}:${level[1]}` : a.type;
    })
    .sort();
  expect(blocks).toEqual(expected);
};

test.describe('Slash menu', () => {
  test('ED-SLH-01 Slash menu entries', async ({ page }) => {
    test.setTimeout(240_000);
    const twelve = await passageByLabel('1.12');

    await fresh(page, twelve.uuid);
    await page.keyboard.type('/');
    await expect(slashMenuItems(page)).toHaveText([
      'Text',
      'Passage',
      'Heading 1',
      'Heading 2',
      'Heading 3',
      'Abbreviation',
      'Mention',
      'Bullet List',
      'Numbered List',
      'Quote',
    ]);
    await page.keyboard.type('head');
    await expect(slashMenuItems(page)).toHaveText([
      'Heading 1',
      'Heading 2',
      'Heading 3',
    ]);

    // Passage, Mention and Abbreviation are checked by ED-STR-01, ED-ANN-03
    // and ED-ANN-07, which insert them from this menu.
    for (const entry of [
      ['heading', 'Heading 1', ['heading:h1']],
      ['heading', 'Heading 2', ['heading:h2']],
      ['heading', 'Heading 3', ['heading:h3']],
      ['quote', 'Quote', ['blockquote', 'paragraph']],
    ] as const) {
      await test.step(entry[1], async () => {
        restoreTestWork();
        await insertAndCheck(page, twelve, entry);
      });
    }
  });

  test('ED-SLH-01 List entries', async ({ page }) => {
    test.setTimeout(240_000);
    test.fail(
      true,
      'DEV-856: a list made from the slash menu also stores a paragraph row inside its item.',
    );
    const twelve = await passageByLabel('1.12');
    for (const entry of [
      ['bullet', 'Bullet List', ['list', 'list-item']],
      ['numbered', 'Numbered List', ['list', 'list-item']],
    ] as const) {
      await test.step(entry[1], async () => {
        restoreTestWork();
        await insertAndCheck(page, twelve, entry);
      });
    }
  });

  test('ED-SLH-01 Text entry', async ({ page }) => {
    // DEV-855: Text used to leave the typed "/text" in the passage.
    const twelve = await passageByLabel('1.12');
    await insertAndCheck(page, twelve, ['text', 'Text', ['paragraph']]);
  });
});
