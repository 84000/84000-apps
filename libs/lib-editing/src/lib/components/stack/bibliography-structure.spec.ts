import type { WorkDocument } from '@eightyfourthousand/lib-doc-model';

import {
  bibliographyMoveTargets,
  canDeleteBibliographyRow,
  canIndentBibliographyHeading,
  canMergeBibliographyRow,
  canOutdentBibliographyHeading,
  deleteBibliographyRow,
  indentBibliographyHeading,
  moveBibliographyRow,
  newBibliographyEntry,
  newBibliographyHeading,
  outdentBibliographyHeading,
} from './bibliography-structure';
import { heading, loadedBibliography, row } from './bibliography-work.fixture';

// See PassageStackController.spec.ts — building the schema reaches
// `data-access/ssr` through two client barrels that leak it.
jest.mock('next/server', () => ({
  NextRequest: class {},
  NextResponse: class {},
}));
jest.mock('resend', () => ({ Resend: class {} }));

/** Each row as `uuid label`, in order, the new ones as `new`. */
const outline = (work: WorkDocument, fresh: string[] = []) =>
  work.spine
    .entries()
    .map(
      (entry) =>
        `${fresh.includes(entry.uuid) ? 'new' : entry.uuid} ${entry.label}`,
    );

const parentOf = (work: WorkDocument, uuid: string) =>
  work.spine.meta(uuid)?.parent;

/** Reads h1 e1 h2 e2 h3 e3, with h3 under h2. */
const nested = async () => (await loadedBibliography()).bibliography.work;

describe('newBibliographyEntry', () => {
  it('starts an entry after a row, under its heading', async () => {
    const work = await nested();
    const uuid = newBibliographyEntry(work, 'e1') as string;

    expect(outline(work, [uuid])).toEqual([
      'h1 b.1',
      'e1 b.1.1',
      'new b.1.2',
      'h2 b.2',
      'e2 b.2.1',
      'h3 b.2.1',
      'e3 b.2.1.1',
    ]);
    expect(parentOf(work, uuid)).toBe('h1');

    work.undo();
    expect(work.spine.meta(uuid)).toBeNull();
  });

  it('starts a heading’s first entry after the heading', async () => {
    const work = await nested();
    const uuid = newBibliographyEntry(work, 'h2') as string;
    expect(outline(work, [uuid]).slice(2, 5)).toEqual([
      'h2 b.2',
      'new b.2.1',
      'e2 b.2.2',
    ]);
  });
});

describe('newBibliographyHeading', () => {
  it('starts a sibling after its heading and what that holds', async () => {
    const work = await nested();
    const uuid = newBibliographyHeading(work, 'e1') as string;

    expect(outline(work, [uuid]).slice(0, 4)).toEqual([
      'h1 b.1',
      'e1 b.1.1',
      'new b.2',
      'h2 b.3',
    ]);
    expect(parentOf(work, uuid)).toBeUndefined();
  });

  it('starts a sibling under the same parent', async () => {
    const work = await nested();
    const uuid = newBibliographyHeading(work, 'e3') as string;

    expect(outline(work, [uuid]).slice(4)).toEqual([
      'h3 b.2.1',
      'e3 b.2.1.1',
      'new b.2.2',
    ]);
    expect(parentOf(work, uuid)).toBe('h2');
  });

  it('starts a nested heading as its heading’s last child', async () => {
    const work = await nested();
    const uuid = newBibliographyHeading(work, 'h2', {
      nested: true,
    }) as string;

    expect(outline(work, [uuid]).slice(2)).toEqual([
      'h2 b.2',
      'e2 b.2.1',
      'h3 b.2.1',
      'e3 b.2.1.1',
      'new b.2.2',
    ]);
    expect(parentOf(work, uuid)).toBe('h2');

    work.undo();
    expect(work.spine.meta(uuid)).toBeNull();
  });

  it('puts the first heading of a headingless work first', async () => {
    const { work } = (await loadedBibliography([row('a', 1), row('b', 2)]))
      .bibliography;
    const uuid = newBibliographyHeading(work, 'b') as string;

    expect(outline(work, [uuid])).toEqual(['new b.1', 'a b.1.1', 'b b.1.2']);
    expect(parentOf(work, 'a')).toBe(uuid);
  });
});

describe('deleting a row', () => {
  it('deletes an entry', async () => {
    const work = await nested();
    expect(deleteBibliographyRow(work, 'e2')).toBe(true);
    expect(work.spine.meta('e2')).toBeNull();
    expect(work.spine.meta('h3')?.label).toBe('b.2.1');
  });

  it('deletes a heading only once nothing is under it', async () => {
    const work = await nested();
    expect(canDeleteBibliographyRow(work, 'h3')).toBe(false);
    expect(canDeleteBibliographyRow(work, 'h2')).toBe(false);
    expect(deleteBibliographyRow(work, 'h3')).toBe(false);

    deleteBibliographyRow(work, 'e3');
    expect(deleteBibliographyRow(work, 'h3')).toBe(true);
    deleteBibliographyRow(work, 'e2');
    expect(canDeleteBibliographyRow(work, 'h2')).toBe(true);

    work.undo();
    work.undo();
    expect(work.spine.uuids()).toEqual(['h1', 'e1', 'h2', 'e2', 'h3']);
  });

  it('keeps the last row', async () => {
    const work = (await loadedBibliography([heading('h1', 1), row('a', 2)]))
      .bibliography.work;
    expect(deleteBibliographyRow(work, 'a')).toBe(true);
    expect(canDeleteBibliographyRow(work, 'h1')).toBe(false);
  });

  it('keeps a heading that only holds headings', async () => {
    const work = (
      await loadedBibliography([heading('h1', 1), heading('h2', 2, 'h1')])
    ).bibliography.work;
    expect(canDeleteBibliographyRow(work, 'h1')).toBe(false);
    expect(canDeleteBibliographyRow(work, 'h2')).toBe(true);
  });
});

describe('canMergeBibliographyRow', () => {
  it('merges an entry only into the entry before it', async () => {
    const work = await nested();
    expect(canMergeBibliographyRow(work, 'e1')).toBe(false);
    expect(canMergeBibliographyRow(work, 'h2')).toBe(false);
    const uuid = newBibliographyEntry(work, 'e1') as string;
    expect(canMergeBibliographyRow(work, uuid)).toBe(true);
  });
});

describe('indenting and outdenting a heading', () => {
  it('nests a heading under the sibling before it', async () => {
    const work = await nested();
    expect(canIndentBibliographyHeading(work, 'h3')).toBe(false);
    expect(canIndentBibliographyHeading(work, 'e2')).toBe(false);
    expect(indentBibliographyHeading(work, 'h2')).toBe(true);

    expect(outline(work)).toEqual([
      'h1 b.1',
      'e1 b.1.1',
      'h2 b.1.1',
      'e2 b.1.1.1',
      'h3 b.1.1.1',
      'e3 b.1.1.1.1',
    ]);
    expect(parentOf(work, 'h2')).toBe('h1');

    work.undo();
    expect(parentOf(work, 'h2')).toBeUndefined();
    expect(work.spine.meta('e3')?.label).toBe('b.2.1.1');
  });

  it('does not nest under a sibling that does not end where it starts', async () => {
    const work = (
      await loadedBibliography([
        heading('h1', 1),
        heading('h2', 2, 'h1'),
        heading('h3', 3),
      ])
    ).bibliography.work;
    expect(canIndentBibliographyHeading(work, 'h3')).toBe(true);
    expect(canIndentBibliographyHeading(work, 'h2')).toBe(false);
  });

  it('takes a heading out to follow its parent', async () => {
    const work = (
      await loadedBibliography([
        heading('h1', 1),
        heading('h2', 2, 'h1'),
        row('e2', 3, { headingUuid: 'h2' }),
        heading('h3', 4, 'h1'),
        row('e3', 5, { headingUuid: 'h3' }),
      ])
    ).bibliography.work;
    expect(canOutdentBibliographyHeading(work, 'h1')).toBe(false);
    expect(outdentBibliographyHeading(work, 'h2')).toBe(true);

    expect(outline(work)).toEqual([
      'h1 b.1',
      'h3 b.1.1',
      'e3 b.1.1.1',
      'h2 b.2',
      'e2 b.2.1',
    ]);
    expect(parentOf(work, 'h2')).toBeUndefined();

    work.undo();
    expect(work.spine.uuids()).toEqual(['h1', 'h2', 'e2', 'h3', 'e3']);
    expect(parentOf(work, 'h2')).toBe('h1');
  });
});

describe('moving a row', () => {
  it('lists every heading but those the row holds', async () => {
    const work = await nested();
    const uuids = (rowUuid: string) =>
      bibliographyMoveTargets(work, rowUuid).map((entry) => entry.uuid);
    expect(uuids('h2')).toEqual(['h1']);
    expect(uuids('e1')).toEqual(['h1', 'h2', 'h3']);
  });

  it('moves an entry to the end of a heading’s entries', async () => {
    const work = await nested();
    expect(moveBibliographyRow(work, 'e1', 'h2')).toBe(true);
    expect(work.spine.uuids()).toEqual(['h1', 'h2', 'e2', 'e1', 'h3', 'e3']);
    expect(parentOf(work, 'e1')).toBe('h2');

    work.undo();
    expect(work.spine.uuids()).toEqual(['h1', 'e1', 'h2', 'e2', 'h3', 'e3']);
  });

  it('moves a heading and what it holds under another', async () => {
    const work = await nested();
    expect(moveBibliographyRow(work, 'h3', 'h1')).toBe(true);
    expect(outline(work)).toEqual([
      'h1 b.1',
      'e1 b.1.1',
      'h3 b.1.1',
      'e3 b.1.1.1',
      'h2 b.2',
      'e2 b.2.1',
    ]);
  });

  it('moves a heading to the end of the top level', async () => {
    const work = await nested();
    expect(moveBibliographyRow(work, 'h3', null)).toBe(true);
    expect(work.spine.uuids()).toEqual(['h1', 'e1', 'h2', 'e2', 'h3', 'e3']);
    expect(work.spine.meta('h3')?.label).toBe('b.3');
  });

  it('refuses a move into the row’s own rows, or under an entry', async () => {
    const work = await nested();
    expect(moveBibliographyRow(work, 'h2', 'h3')).toBe(false);
    expect(moveBibliographyRow(work, 'e1', 'e2')).toBe(false);
    expect(moveBibliographyRow(work, 'e1', null)).toBe(false);
  });
});

describe('a heading whose rows are not in one run', () => {
  // h3 sits under h1 but sorts after h2, as a stored order may have it.
  const scattered = async () =>
    (
      await loadedBibliography([
        heading('h1', 1),
        heading('h2', 2),
        heading('h3', 3, 'h1'),
        row('e3', 4, { headingUuid: 'h3' }),
      ])
    ).bibliography.work;

  it('offers none of the rows it holds as a place to move to', async () => {
    const work = await scattered();
    expect(
      bibliographyMoveTargets(work, 'h1').map((entry) => entry.uuid),
    ).toEqual(['h2']);
    expect(moveBibliographyRow(work, 'h1', 'h3')).toBe(false);
  });

  it('is not moved apart from what it holds', async () => {
    const work = await scattered();
    expect(moveBibliographyRow(work, 'h1', 'h2')).toBe(false);
    expect(work.spine.uuids()).toEqual(['h1', 'h2', 'h3', 'e3']);
  });

  it('takes a nested heading after all it holds', async () => {
    const work = await scattered();
    const uuid = newBibliographyHeading(work, 'h1', {
      nested: true,
    }) as string;
    expect(outline(work, [uuid])).toEqual([
      'h1 b.1',
      'h2 b.2',
      'h3 b.1.1',
      'e3 b.1.1.1',
      'new b.1.2',
    ]);
  });

  it('keeps an outdented heading after its parent’s run', async () => {
    const work = await scattered();
    expect(outdentBibliographyHeading(work, 'h3')).toBe(true);
    expect(outline(work)).toEqual(['h1 b.1', 'h3 b.2', 'e3 b.2.1', 'h2 b.3']);
  });
});
