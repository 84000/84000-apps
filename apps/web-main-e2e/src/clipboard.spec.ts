import type { Page } from '@playwright/test';
import {
  annotationsOf,
  coveredText,
  passageByLabel,
  passageByUuid,
  type StoredAnnotation,
} from './support/db';
import { caretAtEnd, openEditor, save, selectText } from './support/editor';
import { expect, test } from './support/fixtures';

const copy = (page: Page) => page.keyboard.press('ControlOrMeta+c');
const paste = (page: Page) => page.keyboard.press('ControlOrMeta+v');

/** The text-style spans of a passage that cover `text`. */
const spansOver = async (uuid: string, style: string, text: string) => {
  const stored = await passageByUuid(uuid);
  return (await annotationsOf(uuid)).filter(
    (a) =>
      a.type === 'span' &&
      (a.content as Record<string, string>[]).some(
        (c) => c['text-style'] === style,
      ) &&
      coveredText(stored ?? { content: '' }, a) === text,
  );
};

const termOf = (a: StoredAnnotation | undefined) =>
  (a?.content as { uuid?: string } | undefined)?.uuid ??
  (a?.content as { uuid?: string }[] | undefined)?.find?.((c) => c.uuid)?.uuid;

test.describe('Editing', () => {
  test('ED-EDT-02 Copy and paste', async ({ page, browserName }) => {
    test.skip(browserName !== 'chromium', 'needs clipboard permissions');
    const glossed = await passageByLabel('2.5');
    const twelve = await passageByLabel('1.12');
    const one = await passageByLabel('1.1');
    const glossedAnnotations = await annotationsOf(glossed.uuid);
    const instance = glossedAnnotations.find(
      (a) => a.type === 'glossary-instance',
    );
    expect(coveredText(glossed, instance ?? glossedAnnotations[0])).toBe(
      'great compassion',
    );

    await test.step('a glossary instance', async () => {
      await openEditor(page, {
        main: { tab: 'translation', hash: glossed.uuid },
      });
      await selectText(page, glossed.uuid, 'great compassion');
      await copy(page);
      await openEditor(page, {
        main: { tab: 'translation', hash: twelve.uuid },
      });
      await caretAtEnd(page, twelve.uuid);
      await paste(page);
      await save(page);

      const stored = await passageByUuid(twelve.uuid);
      expect(stored?.content).toMatch(/great compassion$/);
      const pasted = (await annotationsOf(twelve.uuid)).filter(
        (a) => a.type === 'glossary-instance',
      );
      expect(pasted).toHaveLength(1);
      expect(coveredText(stored ?? twelve, pasted[0])).toBe('great compassion');
      expect(termOf(instance)).toBeTruthy();
      expect(termOf(pasted[0])).toBe(termOf(instance));
      expect(await passageByUuid(glossed.uuid)).toEqual(glossed);
      expect(await annotationsOf(glossed.uuid)).toEqual(glossedAnnotations);
    });

    await test.step('an italic span', async () => {
      expect(await spansOver(one.uuid, 'italic', 'lotus pond')).toHaveLength(1);
      await openEditor(page, { main: { tab: 'translation', hash: one.uuid } });
      await selectText(page, one.uuid, 'lotus pond');
      await copy(page);
      await selectText(page, one.uuid, 'light');
      await page.keyboard.press('ArrowRight');
      await page.keyboard.type(' ');
      await paste(page);
      await save(page);
      expect(await spansOver(one.uuid, 'italic', 'lotus pond')).toHaveLength(2);
    });

    await test.step('HTML from another app', async () => {
      const before = (await passageByUuid(twelve.uuid))?.content ?? '';
      await openEditor(page, {
        main: { tab: 'translation', hash: twelve.uuid },
      });
      await page.evaluate(() =>
        navigator.clipboard.write([
          new ClipboardItem({
            'text/html': new Blob(['<p>plain <b>bold</b> <i>italic</i></p>'], {
              type: 'text/html',
            }),
            'text/plain': new Blob(['plain bold italic'], {
              type: 'text/plain',
            }),
          }),
        ]),
      );
      await caretAtEnd(page, twelve.uuid);
      await page.keyboard.type(' ');
      await paste(page);
      await save(page);

      expect((await passageByUuid(twelve.uuid))?.content).toBe(
        `${before} plain bold italic`,
      );
      expect(await spansOver(twelve.uuid, 'text-bold', 'bold')).toHaveLength(1);
      // The editor reads <i> as emphasis.
      expect(await spansOver(twelve.uuid, 'emphasis', 'italic')).toHaveLength(
        1,
      );
    });
  });
});
