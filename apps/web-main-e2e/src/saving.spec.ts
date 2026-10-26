import { isDeepStrictEqual } from 'node:util';
import type { Page } from '@playwright/test';
import {
  annotationsOf,
  coveredText,
  passageByLabel,
  passageByUuid,
  workPassages,
  workSnapshot,
  type StoredAnnotation,
  type StoredPassage,
} from './support/db';
import {
  caretAtEnd,
  isSaveRequest,
  markToasts,
  openEditor,
  labelMenuItem,
  reveal,
  SAVE_ROUTE,
  row,
  save,
  saveButton,
  selectText,
  tab,
  toast,
  typeAtEnd,
  type MainTab,
  type RightTab,
} from './support/editor';
import { expect, test } from './support/fixtures';
import { TEST_WORK } from './support/local-stack';

/** The "D" entry in the abbreviations. */
const abbreviationD = async (): Promise<StoredPassage> => {
  const entries = (await workPassages()).filter(
    (p) => p.type === 'abbreviations' && p.content.startsWith('D '),
  );
  expect(entries).toHaveLength(1);
  return entries[0];
};

/** Where each kind of passage is edited. */
const PLACES: Record<string, { panel: 'main' | 'right'; tab: string }> = {
  summary: { panel: 'main', tab: 'front' },
  acknowledgment: { panel: 'main', tab: 'front' },
  introduction: { panel: 'main', tab: 'front' },
  endnotes: { panel: 'right', tab: 'endnotes' },
  abbreviations: { panel: 'right', tab: 'abbreviations' },
};
const placeOf = (p: StoredPassage) =>
  PLACES[p.type] ?? { panel: 'main' as const, tab: 'translation' };

/**
 * An annotation's attributes as one object. Stored content is a list of
 * single-key objects or one object, and the save may write either.
 */
const attributes = (content: unknown): Record<string, unknown> =>
  Array.isArray(content)
    ? Object.assign({}, ...content)
    : ((content as Record<string, unknown>) ?? {});

/** The seeded attributes a stored annotation no longer carries as seeded. */
const droppedAttributes = (
  seeded: StoredAnnotation,
  stored: StoredAnnotation,
): string[] => {
  const after = attributes(stored.content);
  return Object.entries(attributes(seeded.content))
    .filter(([key, value]) => !isDeepStrictEqual(after[key], value))
    .map(([key]) => key);
};

/** Opens the editor at a passage, in the panel and tab that edit it. */
const openAt = async (page: Page, p: StoredPassage) => {
  const { panel, tab } = placeOf(p);
  await openEditor(
    page,
    panel === 'main'
      ? { main: { tab: tab as MainTab, hash: p.uuid } }
      : { right: { tab: tab as RightTab, hash: p.uuid } },
  );
};

test.describe('Saving', () => {
  test('ED-SAV-01 The Save button', async ({ page }) => {
    const firstEdits = [
      await passageByLabel('1.4'),
      await passageByLabel('n.9'),
      await passageByLabel('s.1'),
      await abbreviationD(),
    ];
    for (const passage of firstEdits) {
      await test.step(`first edit in ${passage.label || passage.content}`, async () => {
        await openAt(page, passage);
        await caretAtEnd(page, passage.uuid);
        await expect(saveButton(page)).toBeHidden();
        await page.keyboard.type('Q');
        await expect(saveButton(page)).toBeVisible();
        await save(page);
        await expect(saveButton(page)).toBeHidden();
      });
    }
  });

  test('ED-SAV-02 Annotation round trip', async ({ page }) => {
    test.setTimeout(300_000);
    const handWritten = new Set([
      'h.1',
      'pl.1',
      'p.1',
      ...Array.from({ length: 12 }, (_, i) => `1.${i + 1}`),
      '2.141',
      'c.1',
      'c.2',
      'ap1.1',
      ...Array.from({ length: 13 }, (_, i) => `n.${i + 1}`),
    ]);
    const fixture = (await workPassages()).filter(
      (p) =>
        (p.toh === null || p.toh === TEST_WORK.toh) &&
        (handWritten.has(p.label) ||
          [
            'summary',
            'acknowledgment',
            'introduction',
            'abbreviations',
          ].includes(p.type)),
    );
    const seeded = new Map<string, StoredAnnotation[]>();
    for (const p of fixture) seeded.set(p.uuid, await annotationsOf(p.uuid));

    // One page load per run of neighbouring passages, saved together.
    const runs: StoredPassage[][] = [];
    for (const p of fixture) {
      const last = runs.at(-1)?.at(-1);
      const near =
        last &&
        placeOf(last).tab === placeOf(p).tab &&
        !(last.label === '1.12' && p.label === '2.141');
      if (near) runs.at(-1)?.push(p);
      else runs.push([p]);
    }
    for (const run of runs) {
      await test.step(`edit ${run[0].label || run[0].type} to ${run.at(-1)?.label}`, async () => {
        await openAt(page, run[0]);
        for (const p of run) {
          await reveal(page, p.uuid, placeOf(p).panel);
          await typeAtEnd(page, p.uuid, 'Q');
        }
        await save(page);
      });
    }

    const problems: string[] = [];
    for (const before of fixture) {
      const name = before.label || before.content.slice(0, 20);
      const after = await passageByUuid(before.uuid);
      if (after?.content !== `${before.content}Q`) {
        problems.push(`${name}: content is ${JSON.stringify(after?.content)}`);
        continue;
      }
      const pool = await annotationsOf(before.uuid);
      const end = before.content.length;
      for (const a of seeded.get(before.uuid) ?? []) {
        const placed = (b: StoredAnnotation) =>
          b.type === a.type &&
          b.toh === a.toh &&
          (a.start === a.end && a.end === end
            ? b.start === b.end && [end, end + 1].includes(b.start)
            : b.start === a.start &&
              (b.end === a.end || (a.end === end && b.end === end + 1)));
        const candidates = pool.filter(placed);
        const kept = candidates.find((b) => !droppedAttributes(a, b).length);
        if (kept) {
          pool.splice(pool.indexOf(kept), 1);
        } else if (candidates.length) {
          const dropped = droppedAttributes(a, candidates[0]);
          pool.splice(pool.indexOf(candidates[0]), 1);
          problems.push(
            `${name}: ${a.type} on "${coveredText(before, a)}" lost ${dropped.join(', ')}`,
          );
        } else {
          problems.push(
            `${name}: lost ${a.type} ${a.start}-${a.end} on "${coveredText(before, a)}"`,
          );
        }
      }
    }
    // Known bug DEV-840: attributes the stack editor does not model yet. Listed
    // so the test still catches any new loss, and fails once DEV-840 is fixed.
    const known = [
      'ac.1: link on "84000.co" lost title',
      'i.2: internal-link on "The Noble Mahāyāna Sūtra on the Four Factors" lost toh',
      'i.2: internal-link on "opening scene" lost subtype, toh',
      'p.1: internal-link on "Mañjuśrī rises to speak" lost label, same_work, subtype',
    ];
    expect(problems).toEqual(known);
  });

  test('ED-SAV-04 Edits typed during a save are kept', async ({ page }) => {
    const p = await passageByLabel('1.4');
    let release: () => void = () => undefined;
    const held = new Promise<void>((resolve) => (release = resolve));
    let holding = true;
    await page.route(SAVE_ROUTE, async (route) => {
      if (holding) {
        holding = false;
        await held;
      }
      await route.continue();
    });
    const saveSent = page.waitForRequest(isSaveRequest);

    await openEditor(page, { main: { tab: 'translation', hash: p.uuid } });
    await typeAtEnd(page, p.uuid, 'ZZBEFORE');
    await markToasts(page);
    await saveButton(page).click();
    await saveSent;
    await typeAtEnd(page, p.uuid, ' ZZDURING');
    release();
    await expect(toast(page, 'Content saved')).toBeVisible();
    await expect(saveButton(page)).toBeVisible();
    await save(page);

    expect((await passageByUuid(p.uuid))?.content).toMatch(
      /ZZBEFORE ZZDURING$/,
    );
  });

  test('ED-SAV-05 One save covers every tab', async ({ page }) => {
    const translation = await passageByLabel('1.4');
    const endnote = await passageByLabel('n.9');
    const front = await passageByLabel('s.1');
    const abbreviation = await abbreviationD();
    let saves = 0;
    page.on('request', (r) => {
      if (isSaveRequest(r)) saves++;
    });

    await openEditor(page, {
      main: { tab: 'translation', hash: translation.uuid },
      right: { tab: 'endnotes', hash: endnote.uuid },
    });
    await typeAtEnd(page, translation.uuid, 'Q');
    await typeAtEnd(page, endnote.uuid, 'Q');
    await tab(page, 'Abbr').click();
    await expect(row(page, abbreviation.uuid)).toBeVisible();
    await typeAtEnd(page, abbreviation.uuid, 'Q');
    await tab(page, 'Front').click();
    await expect(row(page, front.uuid)).toBeVisible();
    await typeAtEnd(page, front.uuid, 'Q');

    await save(page);
    await expect(saveButton(page)).toBeHidden();
    await expect(toast(page, 'Content saved')).toHaveCount(1);
    expect(saves).toBe(1);
    for (const p of [translation, endnote, front, abbreviation]) {
      expect((await passageByUuid(p.uuid))?.content).toBe(`${p.content}Q`);
    }
  });

  test('ED-SAV-06 A failed save can be retried', async ({ page }) => {
    const p = await passageByLabel('1.4');
    let failing = true;
    // A 400 with a PostgREST error is a rejection the server reports, so the
    // save is known to have failed. An aborted request is ED-SAV-10.
    await page.route(SAVE_ROUTE, (route) =>
      failing
        ? route.fulfill({
            status: 400,
            contentType: 'application/json',
            body: JSON.stringify({
              code: 'P0001',
              message: 'Rejected by the e2e test.',
              details: null,
              hint: null,
            }),
          })
        : route.continue(),
    );

    await openEditor(page, { main: { tab: 'translation', hash: p.uuid } });
    await typeAtEnd(page, p.uuid, 'Q');
    await markToasts(page);
    await saveButton(page).click();
    await expect(toast(page, 'Error saving content.')).toBeVisible();
    await expect(saveButton(page)).toBeVisible();
    expect((await passageByUuid(p.uuid))?.content).toBe(p.content);

    failing = false;
    await save(page);
    expect((await passageByUuid(p.uuid))?.content).toBe(`${p.content}Q`);
  });

  test('ED-SAV-10 A save whose outcome is unknown is read back', async ({
    page,
  }) => {
    test.fixme(
      true,
      'Still fails after DEV-836: aborting the save of an edit to 1.4 shows no "may have gone through" toast. Not yet diagnosed.',
    );
    const p = await passageByLabel('1.4');
    let requests = 0;
    await page.route(SAVE_ROUTE, (route) => {
      requests++;
      return route.abort('failed');
    });

    await openEditor(page, { main: { tab: 'translation', hash: p.uuid } });
    await typeAtEnd(page, p.uuid, 'Q');
    await markToasts(page);
    await saveButton(page).click();
    await expect(toast(page, /may have gone through/)).toBeVisible();
    await expect(row(page, p.uuid)).toHaveText(p.content);
    expect(requests).toBe(1);
    expect((await passageByUuid(p.uuid))?.content).toBe(p.content);
  });

  test('ED-SAV-07 Passages the user did not edit are not written', async ({
    page,
  }) => {
    const edited = await passageByLabel('1.4');
    const visited = [
      await passageByLabel('1.12'),
      await passageByLabel('1.11'),
    ];
    const before = await workSnapshot();

    await openEditor(page, { main: { tab: 'translation', hash: edited.uuid } });
    for (const p of visited) {
      await reveal(page, p.uuid);
      await caretAtEnd(page, p.uuid);
    }
    await typeAtEnd(page, edited.uuid, 'Q');
    await save(page);

    const after = await workSnapshot();
    const others = ({ passages, annotations }: typeof before) => ({
      passages: passages.filter((p) => p['uuid'] !== edited.uuid),
      annotations: annotations.filter((a) => a['passage_uuid'] !== edited.uuid),
    });
    expect(others(after)).toEqual(others(before));
    expect((await passageByUuid(edited.uuid))?.content).toBe(
      `${edited.content}Q`,
    );
  });

  test('ED-SAV-08 Overlapping annotations save', async ({ page }) => {
    const p = await passageByLabel('1.20');
    const exact = await passageByLabel('1.13');
    const exactBefore = await annotationsOf(exact.uuid);
    const instance = (await annotationsOf(p.uuid)).find(
      (a) => a.type === 'glossary-instance',
    );
    expect(instance && coveredText(p, instance)).toBe('great compassion');

    await openEditor(page, { main: { tab: 'translation', hash: exact.uuid } });
    await typeAtEnd(page, exact.uuid, 'Q');
    await reveal(page, p.uuid);
    await selectText(page, p.uuid, 'compassion is their');
    await page.getByRole('button', { name: 'Comment on selection' }).click();
    await page.getByPlaceholder('Add a comment…').fill('ZZ overlapping');
    await page.getByRole('button', { name: 'Comment', exact: true }).click();
    await typeAtEnd(page, p.uuid, 'Q');
    await save(page);

    const stored = await passageByLabel('1.20');
    expect(stored.content).toBe(`${p.content}Q`);
    const after = await annotationsOf(p.uuid);
    const union = (rows: StoredAnnotation[]) =>
      rows.map((a) => coveredText(stored, a)).join('');
    const instanceRows = after
      .filter(
        (a) =>
          a.type === 'glossary-instance' &&
          isDeepStrictEqual(a.content, instance?.content),
      )
      .sort((a, b) => a.start - b.start);
    expect(union(instanceRows)).toBe('great compassion');
    expect(instanceRows[0].start).toBe(instance?.start);
    const comments = after
      .filter((a) => a.type === 'comment')
      .sort((a, b) => a.start - b.start);
    expect(union(comments)).toBe('compassion is their');

    const exactAfter = await annotationsOf(exact.uuid);
    const shape = (rows: StoredAnnotation[]) =>
      rows
        .filter((a) => a.type !== 'paragraph')
        .map(({ type, start, end, content }) => ({
          type,
          start,
          end,
          content,
        }));
    expect(shape(exactAfter)).toEqual(shape(exactBefore));
  });

  test('ED-SAV-09 Deleting an endnote does not bring its links back', async ({
    page,
  }) => {
    const note = await passageByLabel('n.6');
    const linking = await passageByLabel('1.20');

    await openEditor(page, {
      main: { tab: 'translation', hash: linking.uuid },
      right: { tab: 'endnotes', hash: note.uuid },
    });
    await labelMenuItem(page, note.uuid, 'Delete');
    await page.getByRole('button', { name: 'Delete', exact: true }).click();
    await save(page);
    await typeAtEnd(page, linking.uuid, 'Q');
    await save(page);

    expect(await passageByUuid(note.uuid)).toBeNull();
    const { annotations } = await workSnapshot();
    const links = annotations.filter(
      (a) =>
        a['type'] === 'end-note-link' &&
        JSON.stringify(a['content']).includes(note.uuid),
    );
    expect(links).toEqual([]);
  });
});
