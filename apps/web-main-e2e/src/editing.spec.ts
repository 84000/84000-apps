import type { Locator } from '@playwright/test';
import { db, passageByLabel } from './support/db';
import { openEditor, pointAt, reveal, settled } from './support/editor';
import { expect, test } from './support/fixtures';

/** Sentences appended to a passage to make its row taller than the window. */
const filler = Array.from(
  { length: 120 },
  (_, i) =>
    `Line ${String(i + 1).padStart(3, '0')} lengthens this passage well past the window.`,
).join(' ');

/** Lengthens a passage in place, keeping its paragraph annotation whole. */
const lengthen = async (uuid: string, content: string) => {
  const longer = `${content} ${filler}`;
  const passages = await db()
    .from('passages')
    .update({ content: longer })
    .eq('uuid', uuid);
  if (passages.error) throw new Error(passages.error.message);
  const paragraph = await db()
    .from('passage_annotations')
    .update({ end: longer.length })
    .eq('passage_uuid', uuid)
    .eq('type', 'paragraph');
  if (paragraph.error) throw new Error(paragraph.error.message);
};

/** The text from the caret to the end of its text node. */
const textAfterCaret = (editor: Locator) =>
  editor.evaluate((el) => {
    const selection = el.ownerDocument.getSelection();
    const node = selection?.anchorNode;
    if (!selection?.isCollapsed || !node?.textContent) return '';
    return node.textContent.slice(selection.anchorOffset);
  });

test.describe('Editing', () => {
  test('ED-EDT-05 Clicking into a passage taller than the window', async ({
    page,
  }, testInfo) => {
    const passage = await passageByLabel('1.52');
    await lengthen(passage.uuid, passage.content);
    await page.setViewportSize({ width: 1440, height: 700 });

    await openEditor(page);
    const target = await reveal(page, passage.uuid);
    await settled(target);

    // Scroll so the row starts above the window and ends below it. Retried:
    // rows above can still be measuring, which moves this one.
    await expect(async () => {
      const box = await target.boundingBox();
      if (!box) throw new Error('row not drawn');
      expect(box.height).toBeGreaterThan(700 * 1.5);
      await page.mouse.move(box.x + box.width / 2, 350);
      await page.mouse.wheel(0, box.y + box.height / 3);
      await settled(target);
      const drawn = await target.boundingBox();
      expect(drawn?.y).toBeLessThan(0);
      expect((drawn?.y ?? 0) + (drawn?.height ?? 0)).toBeGreaterThan(700);
    }).toPass({ timeout: 30_000 });
    const drawn = await target.boundingBox();

    // A word in the middle of the window.
    const word = await target
      .locator('.passage')
      .first()
      .evaluate((el) => {
        const walker = el.ownerDocument.createTreeWalker(
          el,
          NodeFilter.SHOW_TEXT,
        );
        while (walker.nextNode()) {
          const node = walker.currentNode as Text;
          for (const m of node.data.matchAll(/Line \d{3}/g)) {
            const range = el.ownerDocument.createRange();
            range.setStart(node, m.index ?? 0);
            range.setEnd(node, (m.index ?? 0) + 1);
            const { top } = range.getBoundingClientRect();
            if (top > 300) return m[0];
          }
        }
        throw new Error('no line in the middle of the window');
      });
    const before = await pointAt(page, passage.uuid, word, 'start');
    await testInfo.attach('before click', {
      body: await page.screenshot(),
      contentType: 'image/png',
    });

    await page.mouse.click(before.x + 1, before.y);

    const editor = target.locator('.ProseMirror[contenteditable="true"]');
    await expect(editor).toBeFocused();
    // The reveal scroll, when there is one, lands a few frames after focus.
    await page.waitForTimeout(1_000);
    await settled(target);
    await testInfo.attach('after click', {
      body: await page.screenshot(),
      contentType: 'image/png',
    });
    // The panel did not scroll: the row is where it was.
    expect((await target.boundingBox())?.y).toBeCloseTo(drawn?.y ?? NaN, 0);
    const after = await pointAt(page, passage.uuid, word, 'start');
    expect(Math.abs(after.y - before.y)).toBeLessThan(2);
    expect(await textAfterCaret(editor)).toMatch(new RegExp(`^${word}`));
  });
});
