import {
  expect,
  type Locator,
  type Page,
  type Request,
} from '@playwright/test';
import { TEST_WORK } from './local-stack';

/** Editor panel tabs, as they appear in the URL. */
export type MainTab = 'front' | 'translation' | 'compare' | 'source';
export type RightTab =
  | 'endnotes'
  | 'glossary'
  | 'bibliography'
  | 'abbreviations';

type PanelState<T extends string> = { tab: T; hash?: string };

/**
 * Opens the editor on the test work. Each panel opens on its tab, scrolled to
 * the passage `hash` names when there is one.
 */
export const openEditor = async (
  page: Page,
  {
    main = { tab: 'translation' },
    right,
    toh = TEST_WORK.toh,
  }: {
    main?: PanelState<MainTab>;
    right?: PanelState<RightTab>;
    toh?: string;
  } = {},
): Promise<void> => {
  const panel = ({ tab, hash }: PanelState<string>) =>
    ['open', tab, hash].filter(Boolean).join(':');
  const query = new URLSearchParams({ toh, main: panel(main) });
  query.set('right', right ? panel(right) : 'closed:endnotes');
  await page.goto(`/translations/editor/${TEST_WORK.uuid}?${query}`);
  await expect(
    page.locator('[data-stack-passage]:visible').first(),
  ).toBeVisible({
    timeout: 120_000,
  });
};

/** The row of a passage, in whichever panel shows it. */
export const row = (page: Page, uuid: string): Locator =>
  page.locator(`[data-stack-passage="${uuid}"]:visible`);

/** A panel tab by its visible name, such as "Front" or "Abbr". */
export const tab = (page: Page, name: string): Locator =>
  page.getByRole('tab', { name, exact: true }).filter({ visible: true });

/** The editor's Save button. */
export const saveButton = (page: Page): Locator =>
  page
    .getByRole('button', { name: 'Save', exact: true })
    .filter({ visible: true });

/** A toast with this text that appeared since the last `markToasts`. */
export const toast = (page: Page, text: string | RegExp): Locator =>
  page.locator('[data-sonner-toast]:not([data-e2e-seen])', { hasText: text });

/** Marks the toasts on screen, so `toast` only finds ones that come after. */
export const markToasts = (page: Page): Promise<void> =>
  page
    .locator('[data-sonner-toast]')
    .evaluateAll((toasts) =>
      toasts.forEach((t) => t.setAttribute('data-e2e-seen', '')),
    );

/**
 * Focuses a passage and puts the caret at the very end of its content, which
 * mounts its live editor.
 */
export const caretAtEnd = async (
  page: Page,
  uuid: string,
): Promise<Locator> => {
  const target = row(page, uuid);
  await target.scrollIntoViewIfNeeded();
  await target.locator('.passage').first().click();
  const editor = target.locator('.ProseMirror[contenteditable="true"]');
  await expect(editor).toBeFocused();
  await editor.evaluate((el) => {
    const selection = el.ownerDocument.getSelection();
    selection?.selectAllChildren(el);
    selection?.collapseToEnd();
  });
  return editor;
};

/** Types text at the end of a passage. */
export const typeAtEnd = async (
  page: Page,
  uuid: string,
  text: string,
): Promise<void> => {
  await caretAtEnd(page, uuid);
  await page.keyboard.type(text);
};

/** Clicks Save and waits for the success toast. */
export const save = async (page: Page): Promise<void> => {
  await markToasts(page);
  await saveButton(page).click();
  await expect(toast(page, 'Content saved')).toBeVisible();
};

/** The request a save writes passages with, as a route pattern. */
export const SAVE_ROUTE = '**/rest/v1/rpc/apply_passage_save';

/** Whether a request is a passage save. */
export const isSaveRequest = (request: Request): boolean =>
  request.method() === 'POST' &&
  new URL(request.url()).pathname.endsWith('/rpc/apply_passage_save');

/**
 * Selects the `occurrence`th instance of `text` in a passage's live editor.
 */
export const selectText = async (
  page: Page,
  uuid: string,
  text: string,
  occurrence = 0,
): Promise<void> => {
  const editor = await caretAtEnd(page, uuid);
  await editor.evaluate(
    (el, { text, occurrence }) => {
      const walker = el.ownerDocument.createTreeWalker(
        el,
        NodeFilter.SHOW_TEXT,
      );
      const nodes: Text[] = [];
      while (walker.nextNode()) nodes.push(walker.currentNode as Text);
      const full = nodes.map((n) => n.data).join('');
      let at = -1;
      for (let i = 0; i <= occurrence; i++) at = full.indexOf(text, at + 1);
      if (at < 0) throw new Error(`"${text}" not found`);
      const point = (offset: number): [Text, number] => {
        for (const node of nodes) {
          if (offset <= node.data.length) return [node, offset];
          offset -= node.data.length;
        }
        throw new Error('offset out of range');
      };
      const range = el.ownerDocument.createRange();
      range.setStart(...point(at));
      range.setEnd(...point(at + text.length));
      const selection = el.ownerDocument.getSelection();
      selection?.removeAllRanges();
      selection?.addRange(range);
    },
    { text, occurrence },
  );
};

/** Waits until a row stops moving, as a panel settles after a deep link. */
export const settled = async (target: Locator): Promise<void> => {
  let last = '';
  await expect
    .poll(
      async () => {
        const box = JSON.stringify(await target.boundingBox());
        const same = box === last;
        last = box;
        return same;
      },
      { intervals: [300] },
    )
    .toBe(true);
};

/** Picks an item from a passage's label menu. */
export const labelMenuItem = async (
  page: Page,
  uuid: string,
  item: string,
): Promise<void> => {
  const label = row(page, uuid).locator(
    `[data-passage-label][data-uuid="${uuid}"]`,
  );
  await settled(label);
  // The menu closes if the stack re-renders under it, so retry the pair.
  await expect(async () => {
    if (!(await page.getByRole('menu').isVisible())) await label.click();
    await page
      .getByRole('menuitem', { name: item, exact: true })
      .click({ timeout: 2_000 });
  }).toPass({ timeout: 30_000 });
};

/**
 * Scrolls a panel down until a passage's row is drawn. Rows are virtualized,
 * so one far from the panel's position does not exist yet.
 */
export const reveal = async (
  page: Page,
  uuid: string,
  panel: 'main' | 'right' = 'main',
): Promise<Locator> => {
  const target = row(page, uuid);
  for (let step = 0; step < 60 && !(await target.count()); step++) {
    await page.evaluate((panel) => {
      const rows = [
        ...document.querySelectorAll<HTMLElement>(
          `[data-panel="${panel}"] [data-stack-passage]`,
        ),
      ].filter((el) => el.offsetParent);
      let scroller = rows.at(-1)?.parentElement ?? null;
      const scrolls = (el: HTMLElement) =>
        /auto|scroll/.test(getComputedStyle(el).overflowY) &&
        el.scrollHeight > el.clientHeight + 1;
      while (scroller && !scrolls(scroller)) {
        scroller = scroller.parentElement;
      }
      scroller?.scrollBy(0, scroller.clientHeight * 0.8);
    }, panel);
    await page.waitForTimeout(250);
  }
  await expect(target).toBeVisible();
  return target;
};
