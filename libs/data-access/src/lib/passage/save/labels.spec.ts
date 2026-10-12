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
  const changed = planLabels({ index, ...plan });
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
    });

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
      }).size,
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
      }).size,
    ).toBe(0);
  });
});
