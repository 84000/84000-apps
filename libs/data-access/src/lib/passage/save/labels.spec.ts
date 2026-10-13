import { planLabels, type LabelRow } from './labels';

const row = (
  uuid: string,
  label: string,
  sort: number,
  toh: string | null = null,
): LabelRow => ({ uuid, label, sort, toh });

/** Every row's label after the plan, by uuid. */
const labelsAfter = (
  index: LabelRow[],
  plan: Omit<Parameters<typeof planLabels>[0], 'index'>,
) => {
  const changed = planLabels({ index, ...plan }).final;
  return Object.fromEntries(
    index
      .filter((r) => !plan.deletedUuids.has(r.uuid))
      .map((r) => [r.uuid, changed.get(r.uuid) ?? r.label]),
  );
};

const none = new Set<string>();

describe('planLabels', () => {
  it('walks past an unlabelled passage without giving it a number', () => {
    // n.2 was inserted at sort 2; the rows after it still hold the old labels.
    const index = [
      row('new', 'n.2', 2),
      row('blank', '', 3),
      row('a', 'n.2', 4),
      row('b', 'n.3', 5),
    ];

    const changed = planLabels({
      index,
      inserts: [{ sort: 2, label: 'n.2' }],
      deletedUuids: none,
      clientRenumberedUuids: new Set(['new']),
    }).final;

    expect(Object.fromEntries(changed)).toEqual({ a: 'n.3', b: 'n.4' });
  });

  // Renaming prefixes one at a time chained: `3.` to `4.` and then `4.` to
  // `5.` moved the first child twice.
  it('renames each child prefix exactly once on an insert', () => {
    const index = [
      row('new', '3', 3),
      row('a', '3', 4),
      row('a1', '3.1', 5),
      row('b', '4', 6),
      row('b1', '4.1', 7),
      row('b2', '4.2', 8),
    ];

    expect(
      labelsAfter(index, {
        inserts: [{ sort: 3, label: '3' }],
        deletedUuids: none,
        clientRenumberedUuids: new Set(['new']),
      }),
    ).toEqual({
      new: '3',
      a: '4',
      a1: '4.1',
      b: '5',
      b1: '5.1',
      b2: '5.2',
    });
  });

  it('renames each child prefix exactly once on a delete', () => {
    const index = [
      row('a', 'n.1', 1),
      row('gone', 'n.2', 2),
      row('b', 'n.3', 3),
      row('b1', 'n.3.1', 4),
      row('c', 'n.4', 5),
      row('c1', 'n.4.1', 6),
    ];

    expect(
      labelsAfter(index, {
        inserts: [],
        deletedUuids: new Set(['gone']),
        clientRenumberedUuids: none,
      }),
    ).toEqual({
      a: 'n.1',
      b: 'n.2',
      b1: 'n.2.1',
      c: 'n.3',
      c1: 'n.3.1',
    });
  });

  it('moves every per-text variant of a slot to the same number', () => {
    const index = [
      row('new', 'n.2', 2),
      row('v1', 'n.2', 3, 'toh1'),
      row('v2', 'n.2', 3, 'toh2'),
      row('c', 'n.3', 4),
    ];

    expect(
      labelsAfter(index, {
        inserts: [{ sort: 2, label: 'n.2' }],
        deletedUuids: none,
        clientRenumberedUuids: new Set(['new']),
      }),
    ).toEqual({ new: 'n.2', v1: 'n.3', v2: 'n.3', c: 'n.4' });
  });

  it('stops at a contiguous tail, but not at a row the client renumbered', () => {
    const index = [
      row('new', 'n.2', 2),
      row('a', 'n.3', 3),
      row('b', 'n.3', 4),
      row('c', 'n.4', 5),
      row('d', 'n.6', 6),
    ];

    expect(
      labelsAfter(index, {
        inserts: [{ sort: 2, label: 'n.2' }],
        deletedUuids: none,
        clientRenumberedUuids: new Set(['new', 'a']),
      }),
    ).toEqual({ new: 'n.2', a: 'n.3', b: 'n.4', c: 'n.5', d: 'n.6' });
  });

  it('renumbers after a deleted note from the label an insert gave it', () => {
    const index = [
      row('n1', 'n.1', 10),
      row('x', 'n.2', 11),
      row('n2', 'n.2', 12),
      row('n3', 'n.3', 13),
      row('n4', 'n.4', 14),
      row('n5', 'n.5', 15),
    ];

    expect(
      labelsAfter(index, {
        inserts: [{ sort: 11, label: 'n.2' }],
        deletedUuids: new Set(['n4']),
        clientRenumberedUuids: new Set(['x']),
      }),
    ).toEqual({ n1: 'n.1', x: 'n.2', n2: 'n.3', n3: 'n.4', n5: 'n.5' });
  });

  it('does not walk from an unlabelled deleted passage', () => {
    const index = [row('gone', '', 1), row('a', '5', 2), row('b', '6', 3)];

    expect(
      planLabels({
        index,
        inserts: [],
        deletedUuids: new Set(['gone']),
        clientRenumberedUuids: none,
      }).final.size,
    ).toBe(0);
  });

  it('leaves a series after a different prefix alone', () => {
    const index = [
      row('new', 'n.2', 2),
      row('a', 'm.2', 3),
      row('b', 'n.2', 4),
    ];

    expect(
      planLabels({
        index,
        inserts: [{ sort: 2, label: 'n.2' }],
        deletedUuids: none,
        clientRenumberedUuids: new Set(['new']),
      }).final.size,
    ).toBe(0);
  });

  it('stops at a shallower label', () => {
    const index = [
      row('new', 'n.2.1', 2),
      row('a', 'n.2.1', 3),
      row('b', 'n.3', 4),
      row('c', 'n.2.2', 5),
    ];

    expect(
      labelsAfter(index, {
        inserts: [{ sort: 2, label: 'n.2.1' }],
        deletedUuids: none,
        clientRenumberedUuids: new Set(['new']),
      }),
    ).toEqual({ new: 'n.2.1', a: 'n.2.2', b: 'n.3', c: 'n.2.2' });
  });

  it("renames only a passage's own children, not a namesake before it", () => {
    const index = [
      row('early', '3.9', 1),
      row('new', '3', 3),
      row('a', '3', 4),
      row('dot', '3.', 5),
    ];

    expect(
      labelsAfter(index, {
        inserts: [{ sort: 3, label: '3' }],
        deletedUuids: none,
        clientRenumberedUuids: new Set(['new']),
      }),
    ).toEqual({ early: '3.9', new: '3', a: '4', dot: '4.' });
  });

  it('ends the children at the first passage that is not one', () => {
    const index = [
      row('new', '3', 2),
      row('a', '3', 3),
      row('a1', '3.1', 4),
      row('a2', '3.2', 5),
      row('m', 'm.1', 6),
      row('stray', '3.3', 7),
      row('b', '4', 8),
    ];

    expect(
      labelsAfter(index, {
        inserts: [{ sort: 2, label: '3' }],
        deletedUuids: none,
        clientRenumberedUuids: new Set(['new']),
      }),
    ).toEqual({
      new: '3',
      a: '4',
      a1: '4.1',
      a2: '4.2',
      m: 'm.1',
      stray: '3.3',
      b: '5',
    });
  });

  it('renames each Toh its own children where Tohs share labels', () => {
    const index = [
      row('new', '3', 3),
      row('v1', '3', 4, 'toh1'),
      row('v2', '3', 4, 'toh2'),
      row('v1a', '3.1', 5, 'toh1'),
      row('v2a', '3.1', 6, 'toh2'),
      row('v1b', '3.2', 7, 'toh1'),
      row('v2b', '3.2', 8, 'toh2'),
      row('next', '4', 9),
      row('late', '3.9', 20, 'toh1'),
    ];

    expect(
      labelsAfter(index, {
        inserts: [{ sort: 3, label: '3' }],
        deletedUuids: none,
        clientRenumberedUuids: new Set(['new']),
      }),
    ).toEqual({
      new: '3',
      v1: '4',
      v2: '4',
      v1a: '4.1',
      v2a: '4.1',
      v1b: '4.2',
      v2b: '4.2',
      next: '5',
      late: '3.9',
    });
  });

  it("does not take a Toh's own children for another's on a delete", () => {
    const index = [
      row('a', '2', 1, 'toh1'),
      row('gone', '3', 2, 'toh1'),
      row('b', '4', 3, 'toh1'),
      row('other', '4.1', 4, 'toh2'),
      row('b1', '4.1', 5, 'toh1'),
    ];

    expect(
      labelsAfter(index, {
        inserts: [],
        deletedUuids: new Set(['gone']),
        clientRenumberedUuids: none,
      }),
    ).toEqual({ a: '2', b: '3', other: '4.1', b1: '3.1' });
  });

  it('does not walk from a label without a number', () => {
    const index = [row('new', 'n.x', 2), row('a', 'n.x', 3)];

    expect(
      planLabels({
        index,
        inserts: [{ sort: 2, label: 'n.x' }],
        deletedUuids: none,
        clientRenumberedUuids: new Set(['new']),
      }).final.size,
    ).toBe(0);
  });

  it('sends the children of two rows sharing a stale label after the first', () => {
    const index = [
      row('new', 'n.3', 2),
      row('x', 'n.3', 3),
      row('x1', 'n.3.1', 4),
      row('y', 'n.3', 5),
      row('z', 'n.4', 6),
    ];

    expect(
      labelsAfter(index, {
        inserts: [{ sort: 2, label: 'n.3' }],
        deletedUuids: none,
        clientRenumberedUuids: new Set(['new']),
      }),
    ).toMatchObject({ x: 'n.4', x1: 'n.4.1', y: 'n.5' });
  });

  it('keeps the series when one per-text variant of a slot is deleted', () => {
    const index = [
      row('a', 'n.1', 1),
      row('v1', 'n.2', 2, 'toh1'),
      row('v2', 'n.2', 2, 'toh2'),
      row('c', 'n.3', 3),
    ];

    expect(
      planLabels({
        index,
        inserts: [],
        deletedUuids: new Set(['v2']),
        clientRenumberedUuids: none,
      }).final.size,
    ).toBe(0);
  });

  it('passes over an unlabelled passage among the children', () => {
    const index = [
      row('new', '3', 2),
      row('a', '3', 3),
      row('a1', '3.1', 4),
      row('blank', '', 5),
      row('a2', '3.2', 6),
      row('b', '4', 7),
    ];

    expect(
      labelsAfter(index, {
        inserts: [{ sort: 2, label: '3' }],
        deletedUuids: none,
        clientRenumberedUuids: new Set(['new']),
      }),
    ).toEqual({ new: '3', a: '4', a1: '4.1', blank: '', a2: '4.2', b: '5' });
  });

  it('passes over a child the client already moved with its parent', () => {
    const index = [
      row('new', '3', 2),
      row('a', '3', 3),
      row('a1', '4.1', 4),
      row('a2', '3.2', 5),
      row('b', '4', 6),
    ];

    expect(
      labelsAfter(index, {
        inserts: [{ sort: 2, label: '3' }],
        deletedUuids: none,
        clientRenumberedUuids: new Set(['new', 'a1']),
      }),
    ).toEqual({ new: '3', a: '4', a1: '4.1', a2: '4.2', b: '5' });
  });

  it('renames the per-Toh children of a passage without a Toh', () => {
    const index = [
      row('new', '3', 2),
      row('a', '3', 3),
      row('a1', '3.1', 4, 'toh1'),
      row('a1v', '3.1', 5, 'toh2'),
      row('b', '4', 6),
    ];

    expect(
      labelsAfter(index, {
        inserts: [{ sort: 2, label: '3' }],
        deletedUuids: none,
        clientRenumberedUuids: new Set(['new']),
      }),
    ).toEqual({ new: '3', a: '4', a1: '4.1', a1v: '4.1', b: '5' });
  });

  it('keeps the slot of a deleted variant whose sibling sits past its children', () => {
    const index = [
      row('a', 'n.1', 1),
      row('v1', 'n.2', 2, 'toh1'),
      row('v1a', 'n.2.1', 3, 'toh1'),
      row('v2', 'n.2', 4, 'toh2'),
      row('c', 'n.3', 5),
    ];

    expect(
      planLabels({
        index,
        inserts: [],
        deletedUuids: new Set(['v1']),
        clientRenumberedUuids: none,
      }).final.size,
    ).toBe(0);
  });

  it('closes the slot when the only namesake of another Toh is elsewhere', () => {
    const index = [
      row('far', 'n.2', 0, 'toh2'),
      row('a', 'n.1', 1),
      row('gone', 'n.2', 2, 'toh1'),
      row('c', 'n.3', 3),
      row('d', 'n.4', 4),
    ];

    expect(
      labelsAfter(index, {
        inserts: [],
        deletedUuids: new Set(['gone']),
        clientRenumberedUuids: none,
      }),
    ).toEqual({ far: 'n.2', a: 'n.1', c: 'n.2', d: 'n.3' });
  });

  it('walks from a deleted variant whose slot the client moved another onto', () => {
    // E was stored as n.6 and sent as n.5, so D's slot is not still held.
    const index = [
      row('c', 'n.4', 4),
      row('d', 'n.5', 5, 't1'),
      row('e', 'n.5', 6, 't1'),
      row('f', 'n.7', 7),
      row('g', 'n.8', 8),
    ];

    expect(
      labelsAfter(index, {
        inserts: [],
        deletedUuids: new Set(['d']),
        clientRenumberedUuids: new Set(['e']),
        storedLabels: new Map([
          ['c', 'n.4'],
          ['d', 'n.5'],
          ['e', 'n.6'],
          ['f', 'n.7'],
          ['g', 'n.8'],
        ]),
      }),
    ).toEqual({ c: 'n.4', e: 'n.5', f: 'n.6', g: 'n.7' });
  });

  it('closes the slot once when every variant of it is deleted', () => {
    const index = [
      row('a', 'n.1', 1),
      row('v1', 'n.2', 2, 'toh1'),
      row('v2', 'n.2', 2, 'toh2'),
      row('c', 'n.3', 3),
      row('d', 'n.4', 4),
    ];

    expect(
      labelsAfter(index, {
        inserts: [],
        deletedUuids: new Set(['v1', 'v2']),
        clientRenumberedUuids: none,
      }),
    ).toEqual({ a: 'n.1', c: 'n.2', d: 'n.3' });
  });

  it('plans two inserts and two deletes, and splits the steps', () => {
    const index = [
      row('n1', 'n.1', 1),
      row('x', 'n.2', 2),
      row('n2', 'n.2', 3),
      row('n3', 'n.3', 4),
      row('y', 'n.4', 5),
      row('n4', 'n.4', 6),
      row('n5', 'n.5', 7),
      row('n6', 'n.6', 8),
    ];

    const plan = planLabels({
      index,
      inserts: [
        { sort: 2, label: 'n.2' },
        { sort: 5, label: 'n.4' },
      ],
      deletedUuids: new Set(['n3', 'n5']),
      clientRenumberedUuids: new Set(['x', 'y']),
    });

    // The inserts move n5 to n.7 (written first); the deletes then bring it
    // all back down, leaving only n2 and n4 changed from where they began.
    expect(plan.afterInserts.get('n5')).toBe('n.7');
    expect(plan.afterInserts.get('y')).toBe('n.5');
    expect(Object.fromEntries(plan.final)).toEqual({ n2: 'n.3', n4: 'n.5' });
  });
});
