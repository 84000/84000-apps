import type { Page } from '@playwright/test';
import {
  annotationsOf,
  coveredText,
  passageByLabel,
  passageByUuid,
  type StoredAnnotation,
} from './support/db';
import {
  bubbleMenu,
  openEditor,
  reveal,
  row,
  save,
  selectText,
  typeAtEnd,
  type MainTab,
} from './support/editor';
import { expect, test } from './support/fixtures';

const openAt = async (page: Page, label: string, tab: MainTab) => {
  const { uuid } = await passageByLabel(label);
  await openEditor(page, { main: { tab, hash: uuid } });
  return uuid;
};

/** A passage's rendered marks of one text style. */
const styled = (page: Page, uuid: string, style: string) =>
  row(page, uuid).locator(`[data-text-style="${style}"]`);

const css = (page: Page, uuid: string, style: string, prop: string) =>
  styled(page, uuid, style).evaluate(
    (el, prop) => getComputedStyle(el).getPropertyValue(prop),
    prop,
  );

/** Picks a language from the bubble menu's foreign or mantra dropdown. */
const languageChoice = async (
  page: Page,
  menu: 'languages' | 'speech',
  item: string,
) => {
  await bubbleMenu(page).locator(`button:has(svg.lucide-${menu})`).click();
  await bubbleMenu(page)
    .locator('div.cursor-pointer')
    .filter({ hasText: new RegExp(`^${item}$`) })
    .click();
};

const contentOf = (a: StoredAnnotation) => JSON.stringify(a.content);

test.describe('Inline marks', () => {
  test('ED-MRK-01 Text styles', async ({ page }) => {
    // Twelve saves, two per style.
    test.setTimeout(240_000);
    const front = await openAt(page, 's.2', 'front');
    expect(await css(page, front, 'text-bold', 'font-weight')).toBe('700');
    const six = (await passageByLabel('i.6')).uuid;
    const four = (await passageByLabel('i.4')).uuid;
    await reveal(page, six);
    expect(await css(page, six, 'underline', 'text-decoration-line')).toBe(
      'underline',
    );
    await expect(styled(page, six, 'distinct')).toHaveText('the testing lotus');
    expect(await css(page, four, 'small-caps', 'text-transform')).toBe(
      'uppercase',
    );
    await expect(styled(page, four, 'subscript')).toHaveJSProperty(
      'tagName',
      'SUB',
    );
    await expect(styled(page, four, 'superscript')).toHaveJSProperty(
      'tagName',
      'SUP',
    );
    const one = await openAt(page, '1.1', 'translation');
    expect(await css(page, one, 'italic', 'font-style')).toBe('italic');

    const twelve = await passageByLabel('1.12');
    const spans = async () =>
      (await annotationsOf(twelve.uuid)).filter((a) => a.type === 'span');
    const seeded = await spans();
    await openAt(page, '1.12', 'translation');
    for (const [icon, style] of [
      ['bold', 'text-bold'],
      // The italic button stores the emphasis style.
      ['italic', 'emphasis'],
      ['underline', 'underline'],
      ['subscript', 'subscript'],
      ['superscript', 'superscript'],
      ['case-upper', 'small-caps'],
    ]) {
      await test.step(style, async () => {
        const button = bubbleMenu(page).locator(
          `button:has(svg.lucide-${icon})`,
        );
        await selectText(page, twelve.uuid, 'ordinary');
        await button.click();
        await save(page);
        const added = (await spans()).filter(
          (a) => !seeded.some((s) => s.uuid === a.uuid),
        );
        expect(added.map((a) => coveredText(twelve, a))).toEqual(['ordinary']);
        expect(contentOf(added[0])).toContain(`"${style}"`);

        await selectText(page, twelve.uuid, 'ordinary');
        await button.click();
        await save(page);
        expect(await spans()).toEqual(seeded);
      });
    }
  });

  test('ED-MRK-02 Foreign language and mantra', async ({ page }) => {
    for (const [label, tab, text, lang] of [
      ['i.3', 'front', '試蓮經', 'zh'],
      ['h.1', 'translation', 'སངས་རྒྱས་', 'bo'],
      ['pl.1', 'translation', 'evaṃ me sutaṃ', 'Pi-Ltn'],
      ['c.2', 'translation', 'zhu chen gyi lo tsā ba', 'Bo-Ltn'],
      ['ap1.1', 'translation', 'karuṇā', 'Sa-Ltn'],
    ] as const) {
      const uuid = await openAt(page, label, tab);
      const span = styled(page, uuid, 'foreign').filter({ hasText: text });
      await expect(span).toHaveAttribute('lang', lang);
    }
    const eleven = await openAt(page, '1.11', 'translation');
    await expect(row(page, eleven).locator('span[type="mantra"]')).toHaveText(
      'oṃ padme svāhā',
    );

    const twelve = await passageByLabel('1.12');
    const seeded = await annotationsOf(twelve.uuid);
    await openAt(page, '1.12', 'translation');
    await selectText(page, twelve.uuid, 'great compassion');
    await languageChoice(page, 'languages', 'Sanskrit');
    await save(page);
    const after = await annotationsOf(twelve.uuid);
    const added = after.filter((a) => !seeded.some((s) => s.uuid === a.uuid));
    expect(added.map((a) => [a.type, coveredText(twelve, a)])).toEqual([
      ['span', 'great compassion'],
    ]);
    expect(contentOf(added[0])).toMatch(/"foreign".*"Sa-Ltn"/);
    expect(after.filter((a) => a.type === 'span' && a !== added[0])).toEqual(
      seeded.filter((a) => a.type === 'span'),
    );

    const one = await passageByLabel('1.1');
    await openAt(page, '1.1', 'translation');
    await selectText(page, one.uuid, 'great compassion');
    await languageChoice(page, 'speech', 'Sanskrit');
    await save(page);
    const mantras = (await annotationsOf(one.uuid)).filter(
      (a) => a.type === 'mantra',
    );
    expect(mantras.map((a) => coveredText(one, a))).toEqual([
      'great compassion',
    ]);
  });

  test('ED-MRK-02 A foreign span with no language', async ({ page }) => {
    const uuid = await openAt(page, 'pl.1', 'translation');
    const span = styled(page, uuid, 'foreign').filter({ hasText: 'vajrapada' });
    await expect(span).toBeVisible();
    await expect(span).not.toHaveAttribute('lang', /./, { timeout: 2_000 });
  });

  test('ED-MRK-03 Upright pipes and typography', async ({ page }) => {
    const one = await passageByLabel('1.1');
    await openAt(page, '1.1', 'translation');
    await selectText(page, one.uuid, ' pond');
    await page.keyboard.type('|pond');
    const italic = styled(page, one.uuid, 'italic');
    await expect(italic).toHaveText('lotus|pond');
    const pipe = italic.locator('*', { hasText: /^\|$/ });
    await expect(pipe).toHaveCSS('font-style', 'normal');
    await expect(italic).toHaveCSS('font-style', 'italic');
    await save(page);
    const stored = await passageByUuid(one.uuid);
    expect(stored?.content).toContain('lotus|pond');
    const spans = (await annotationsOf(one.uuid)).filter(
      (a) => a.type === 'span',
    );
    expect(spans.map((a) => coveredText(stored ?? one, a))).toEqual([
      'lotus|pond',
    ]);

    const twelve = await passageByLabel('1.12');
    await openAt(page, '1.12', 'translation');
    await typeAtEnd(page, twelve.uuid, ' -- "quoted"');
    await expect(row(page, twelve.uuid)).toContainText('— “quoted”');
    await save(page);
    expect((await passageByUuid(twelve.uuid))?.content).toMatch(/— “quoted”$/);
  });
});
