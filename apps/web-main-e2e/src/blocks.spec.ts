import type { Page } from '@playwright/test';
import {
  annotationsOf,
  coveredText,
  passageByLabel,
  passageByUuid,
  type StoredAnnotation,
} from './support/db';
import {
  bubbleChoice,
  bubbleMenu,
  caretAtEnd,
  openEditor,
  row,
  save,
  selectText,
  typeAtEnd,
  type MainTab,
} from './support/editor';
import { expect, test } from './support/fixtures';

const openAt = (page: Page, uuid: string, tab: MainTab = 'translation') =>
  openEditor(page, { main: { tab, hash: uuid } });

/** The first block a passage renders. */
const block = (page: Page, uuid: string) =>
  row(page, uuid).locator('.tiptap > *').first();

const shape = (a: Pick<StoredAnnotation, 'type' | 'start' | 'end'>) =>
  `${a.type} ${a.start}-${a.end}`;

const ofType = async (uuid: string, type: string) =>
  (await annotationsOf(uuid)).filter((a) => a.type === type);

/** Whether an annotation's content holds this attribute. */
const holds = (a: StoredAnnotation | undefined, key: string, value: string) =>
  JSON.stringify(a?.content ?? []).includes(`"${key}":"${value}"`) ||
  JSON.stringify(a?.content ?? []).includes(`"${key}": "${value}"`);

const textAlign = (page: Page, uuid: string) =>
  block(page, uuid).evaluate((el) => getComputedStyle(el).textAlign);

test.describe('Blocks', () => {
  test('ED-BLK-01 Block types', async ({ page }) => {
    const twelve = await passageByLabel('1.12');
    const length = twelve.content.length;

    await test.step('seeded blocks', async () => {
      const [heading, verse, quote, quotedVerse, trailer] = await Promise.all(
        ['1.6', '1.2', '1.4', '1.5', '2.141'].map((l) => passageByLabel(l)),
      );
      await openAt(page, heading.uuid);
      await expect(block(page, heading.uuid)).toHaveJSProperty('tagName', 'H3');
      await expect(
        row(page, verse.uuid).locator('li[type="line"]'),
      ).toHaveCount(4);
      for (const p of [quote, quotedVerse]) {
        const indent = await row(page, p.uuid)
          .locator('blockquote')
          .evaluate((el) => parseFloat(getComputedStyle(el).paddingLeft));
        expect(indent).toBeGreaterThan(0);
      }
      await openAt(page, trailer.uuid);
      await expect(
        row(page, trailer.uuid).locator('p[type="trailer"]'),
      ).toHaveText(trailer.content);
    });

    await openAt(page, twelve.uuid);
    for (const [item, type, level] of [
      ['Heading 1', 'heading', 'h1'],
      ['Heading 2', 'heading', 'h2'],
      ['Heading 3', 'heading', 'h3'],
      ['Quote', 'blockquote', ''],
      ['Trailer', 'trailer', ''],
    ] as const) {
      await test.step(item, async () => {
        await selectText(page, twelve.uuid, 'explained');
        await bubbleChoice(page, 'node', item);
        await save(page);
        const blocks = await ofType(twelve.uuid, type);
        expect(blocks.map(shape)).toEqual([`${type} 0-${length}`]);
        if (level) expect(holds(blocks[0], 'heading-level', level)).toBe(true);
        // A quote wraps its paragraph, as 1.4's does.
        expect((await ofType(twelve.uuid, 'paragraph')).map(shape)).toEqual(
          type === 'blockquote' ? [`paragraph 0-${length}`] : [],
        );
        await selectText(page, twelve.uuid, 'explained');
        await bubbleChoice(page, 'node', 'Text');
      });
    }

    await save(page);
    const types = (await annotationsOf(twelve.uuid)).map((a) => a.type);
    expect((await ofType(twelve.uuid, 'paragraph')).map(shape)).toEqual([
      `paragraph 0-${length}`,
    ]);
    for (const type of ['heading', 'blockquote', 'trailer']) {
      expect(types).not.toContain(type);
    }
  });

  test('ED-BLK-02 Lists', async ({ page }) => {
    const bullets = await passageByLabel('1.7');
    const numbered = await passageByLabel('1.8');

    await openAt(page, bullets.uuid);
    await expect(row(page, bullets.uuid).locator('ul li')).toHaveCount(6);
    await expect(row(page, bullets.uuid).locator('ul')).toHaveCSS(
      'list-style-type',
      'disc',
    );
    await expect(row(page, numbered.uuid).locator('ul li')).toHaveCount(4);
    await expect(row(page, numbered.uuid).locator('ul')).toHaveCSS(
      'list-style-type',
      'decimal',
    );

    await caretAtEnd(page, numbered.uuid);
    await page.keyboard.press('Enter');
    await page.keyboard.type('Fifth, rejoice.');
    await save(page);

    const stored = await passageByUuid(numbered.uuid);
    const items = await ofType(numbered.uuid, 'list-item');
    expect(items).toHaveLength(5);
    items.forEach((item, i) =>
      expect(item.start).toBe(i ? items[i - 1].end : 0),
    );
    const length = stored?.content.length ?? 0;
    expect(items.at(-1)?.end).toBe(length);
    expect((await ofType(numbered.uuid, 'list')).map(shape)).toEqual([
      `list 0-${length}`,
    ]);
    expect(coveredText(stored ?? numbered, items[4])).toBe('Fifth, rejoice.');
  });

  test('ED-BLK-03 Tables', async ({ page }) => {
    const table = await passageByLabel('1.10');
    const seeded = await annotationsOf(table.uuid);
    const avarice = table.content.indexOf('Avarice');

    await openAt(page, table.uuid);
    const rows = row(page, table.uuid).locator('table tr');
    await expect(rows).toHaveCount(4);
    for (let i = 0; i < 4; i++) {
      await expect(rows.nth(i).locator('th, td')).toHaveCount(3);
    }
    await expect(rows.first().locator('th')).toHaveCount(3);
    await expect(rows.nth(1).locator('td')).toHaveText([
      /^Generosity\s*$/,
      /^dāna\s*$/,
      /^Avarice\s*$/,
    ]);

    await selectText(page, table.uuid, 'Avarice');
    await page.keyboard.type('Stinginess');
    await expect(rows.nth(1).locator('td')).toHaveText([
      /^Generosity\s*$/,
      /^dāna\s*$/,
      /^Stinginess\s*$/,
    ]);
    await save(page);

    const stored = await passageByUuid(table.uuid);
    const after = await annotationsOf(table.uuid);
    const count = (list: StoredAnnotation[], type: string) =>
      list.filter((a) => a.type === type).length;
    expect(
      ['table', 'table-body-row', 'table-body-header', 'table-body-data'].map(
        (type) => count(after, type),
      ),
    ).toEqual([1, 4, 3, 9]);
    const cell = after.find(
      (a) => a.type === 'table-body-data' && a.start === avarice,
    );
    expect(coveredText(stored ?? table, cell ?? after[0]).trim()).toBe(
      'Stinginess',
    );
    const shift = (at: number) => (at > avarice ? at + 3 : at);
    const sorted = (list: string[]) => [...list].sort();
    expect(sorted(after.map(shape))).toEqual(
      sorted(
        seeded.map((a) =>
          shape({ ...a, start: shift(a.start), end: shift(a.end) }),
        ),
      ),
    );
  });

  test('ED-BLK-04 Text align', async ({ page }) => {
    const [homage, right, justified, title, twelve] = await Promise.all(
      ['h.1', 'i.6', 'i.4', 't.', '1.12'].map((l) => passageByLabel(l)),
    );
    const others = [homage, right, justified, title];
    const before = await Promise.all(others.map((p) => annotationsOf(p.uuid)));

    await openAt(page, right.uuid, 'front');
    await expect.poll(() => textAlign(page, right.uuid)).toBe('right');
    await expect.poll(() => textAlign(page, justified.uuid)).toBe('justify');
    await openAt(page, homage.uuid);
    await expect.poll(() => textAlign(page, homage.uuid)).toBe('center');
    await expect.poll(() => textAlign(page, title.uuid)).toBe('center');

    await openAt(page, twelve.uuid);
    await selectText(page, twelve.uuid, 'explained');
    await bubbleChoice(page, 'align', 'Center');
    await save(page);

    const [paragraph] = await ofType(twelve.uuid, 'paragraph');
    expect(holds(paragraph, 'align', 'center')).toBe(true);
    await openAt(page, twelve.uuid);
    await expect.poll(() => textAlign(page, twelve.uuid)).toBe('center');
    expect(await Promise.all(others.map((p) => annotationsOf(p.uuid)))).toEqual(
      before,
    );
  });

  test('ED-BLK-05 Word break', async ({ page }) => {
    const url = await passageByLabel('i.5');
    const justified = await passageByLabel('i.4');
    const seeded = await annotationsOf(url.uuid);

    await openAt(page, url.uuid, 'front');
    const overflow = await block(page, url.uuid).evaluate(
      (el) => el.scrollWidth - el.clientWidth,
    );
    expect(overflow).toBeLessThanOrEqual(0);
    expect(
      await block(page, url.uuid).evaluate(
        (el) => getComputedStyle(el).wordBreak,
      ),
    ).toBe('break-all');

    await selectText(page, justified.uuid, 'six perfections');
    await bubbleChoice(page, 'wordBreak', 'Break all');
    await save(page);

    const [paragraph] = await ofType(justified.uuid, 'paragraph');
    expect(holds(paragraph, 'word-break', 'break-all')).toBe(true);
    expect(await annotationsOf(url.uuid)).toEqual(seeded);
  });

  test('ED-BLK-06 Leading space and indent', async ({ page }) => {
    const labels = {
      front: ['i.6', 'i.4'],
      translation: ['1.6', '1.2', '1.3', '1.4', '1.7'],
    } as const;
    const leading = ['i.6', '1.6', '1.2', '1.4'];
    const indented = ['i.4', '1.3', '1.7', '1.4'];
    const passages = Object.fromEntries(
      await Promise.all(
        [...labels.front, ...labels.translation].map(
          async (l) => [l, await passageByLabel(l)] as const,
        ),
      ),
    );
    const plain = await passageByLabel('i.5');
    const twelve = await passageByLabel('1.12');

    await openAt(page, passages['i.6'].uuid, 'front');
    const style = (uuid: string) =>
      block(page, uuid).evaluate((el) => {
        const s = getComputedStyle(el);
        return { top: s.marginTop, left: s.paddingLeft + s.textIndent };
      });
    const neighbour = await style(plain.uuid);
    expect((await style(passages['i.6'].uuid)).top).not.toBe(neighbour.top);
    expect((await style(passages['i.4'].uuid)).left).not.toBe(neighbour.left);

    for (const [tab, list] of Object.entries(labels)) {
      if (tab === 'translation') {
        await openAt(page, passages['1.6'].uuid);
      }
      for (const label of list) {
        const target = block(page, passages[label].uuid);
        if (leading.includes(label)) {
          await expect(target).toHaveAttribute('data-leading-space-uuid');
        }
        if (indented.includes(label)) {
          await expect(target).toHaveAttribute('data-indent-uuid');
        }
        await typeAtEnd(page, passages[label].uuid, 'Q');
      }
      await save(page);
    }

    for (const label of Object.keys(passages)) {
      const { uuid, content } = passages[label];
      if (leading.includes(label)) {
        expect((await ofType(uuid, 'leading-space')).map(shape)).toEqual([
          'leading-space 0-0',
        ]);
      }
      if (indented.includes(label)) {
        expect((await ofType(uuid, 'indent')).map(shape)).toEqual([
          `indent 0-${content.length + 1}`,
        ]);
      }
    }

    await openAt(page, twelve.uuid);
    await selectText(page, twelve.uuid, 'explained');
    await bubbleMenu(page)
      .locator('button:has(svg.lucide-list-indent-increase)')
      .click();
    await save(page);
    expect((await ofType(twelve.uuid, 'indent')).map(shape)).toEqual([
      `indent 0-${twelve.content.length}`,
    ]);
  });

  test('ED-BLK-07 Images and audio', async ({ page }) => {
    const pictured = await passageByLabel('1.1');
    const recorded = await passageByLabel('1.11');
    const seeded = {
      image: (await ofType(pictured.uuid, 'image'))[0],
      audio: (await ofType(recorded.uuid, 'audio'))[0],
    };

    await openAt(page, pictured.uuid);
    const image = row(page, pictured.uuid).locator('img');
    await expect(image).toHaveAttribute('src', '/images/lotus-pond.png');
    await expect
      .poll(() => image.evaluate((el: HTMLImageElement) => el.naturalWidth))
      .toBeGreaterThan(0);
    const audioSrc = (seeded.audio.content as { src?: string }[]).find(
      (c) => c.src,
    )?.src;
    expect(audioSrc).toBeTruthy();
    await expect(row(page, recorded.uuid).locator('audio')).toHaveAttribute(
      'src',
      audioSrc as string,
    );

    for (const p of [pictured, recorded]) {
      await selectText(page, p.uuid, 'assembly');
      await page.keyboard.type('gathering');
    }
    await save(page);

    for (const [p, type] of [
      [pictured, 'image'],
      [recorded, 'audio'],
    ] as const) {
      const length = p.content.length + 1;
      expect((await passageByUuid(p.uuid))?.content).toHaveLength(length);
      const [media] = await ofType(p.uuid, type);
      expect(shape(media)).toBe(`${type} ${length}-${length}`);
      const merged = (content: unknown) =>
        Object.assign({}, ...(content as object[]));
      expect(merged(media.content)).toEqual(merged(seeded[type].content));
    }
  });
});
