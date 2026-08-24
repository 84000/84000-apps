import { Spine } from './spine';
import type { PassageMeta } from './types';

const meta = (
  uuid: string,
  label: string,
  type = 'translation',
): Omit<PassageMeta, 'matter'> => ({ uuid, label, type });

const seeded = (count: number) => {
  const spine = new Spine('work-1');
  spine.seed(
    Array.from({ length: count }, (_, i) => meta(`p${i}`, `${i + 1}`)),
  );
  return spine;
};

describe('Spine', () => {
  it('seeds order and metadata in one pass', () => {
    const spine = seeded(3);
    expect(spine.length).toBe(3);
    expect(spine.uuids()).toEqual(['p0', 'p1', 'p2']);
    expect(spine.meta('p1')?.label).toBe('2');
  });

  it('re-seeding replaces the previous contents', () => {
    const spine = seeded(3);
    spine.seed([meta('q0', '1')]);
    expect(spine.uuids()).toEqual(['q0']);
    expect(spine.meta('p0')).toBeNull();
  });

  it('derives matter from the passage type', () => {
    const spine = new Spine('work-1');
    spine.seed([
      meta('a', '1', 'introduction'),
      meta('b', '2', 'translation'),
      meta('c', '3', 'endnotes'),
      meta('d', '4', 'translationHeader'),
    ]);
    expect(spine.meta('a')?.matter).toBe('front');
    expect(spine.meta('b')?.matter).toBe('body');
    expect(spine.meta('c')?.matter).toBe('endnotes');
    expect(spine.meta('d')?.matter).toBe('body');
    expect(spine.matter('front').map((e) => e.uuid)).toEqual(['a']);
  });

  it('re-derives matter when a type changes', () => {
    const spine = seeded(1);
    spine.setType('p0', 'endnotes');
    expect(spine.meta('p0')?.matter).toBe('endnotes');
  });

  describe('windowing', () => {
    it('clamps a window to the spine', () => {
      const spine = seeded(5);
      expect(spine.window(0, 2)).toEqual({ start: 0, end: 3 });
      expect(spine.window(4, 2)).toEqual({ start: 2, end: 5 });
      expect(spine.window(2, 100)).toEqual({ start: 0, end: 5 });
    });

    it('slices without loading anything', () => {
      const spine = seeded(1000);
      const slice = spine.slice({ start: 500, end: 503 });
      expect(slice.map((entry) => entry.uuid)).toEqual([
        'p500',
        'p501',
        'p502',
      ]);
      expect(slice[0].index).toBe(500);
    });

    it('clamps an out-of-range slice rather than throwing', () => {
      const spine = seeded(3);
      expect(spine.slice({ start: -5, end: 99 })).toHaveLength(3);
      expect(spine.slice({ start: 10, end: 20 })).toHaveLength(0);
    });
  });

  describe('insert', () => {
    it('inserts at a position and renumbers below it', () => {
      const spine = seeded(4);
      const { entry, labelChanges } = spine.insert(meta('new', '2'), 1);
      expect(entry.index).toBe(1);
      expect(spine.uuids()).toEqual(['p0', 'new', 'p1', 'p2', 'p3']);
      expect(spine.entries().map((e) => e.label)).toEqual([
        '1',
        '2',
        '3',
        '4',
        '5',
      ]);
      expect(labelChanges).toEqual([
        { uuid: 'p1', from: '2', to: '3' },
        { uuid: 'p2', from: '3', to: '4' },
        { uuid: 'p3', from: '4', to: '5' },
      ]);
    });

    it('appends when the index is past the end', () => {
      const spine = seeded(2);
      expect(spine.insert(meta('new', '3'), 99).entry.index).toBe(2);
    });

    it('does not renumber when told not to', () => {
      const spine = seeded(3);
      const { labelChanges } = spine.insert(meta('new', '2'), 1, {
        renumber: false,
      });
      expect(labelChanges).toEqual([]);
      expect(spine.meta('p1')?.label).toBe('2');
    });
  });

  describe('remove', () => {
    it('removes a contiguous run in one transaction and renumbers', () => {
      const spine = seeded(5);
      spine.remove(['p1', 'p2']);
      expect(spine.uuids()).toEqual(['p0', 'p3', 'p4']);
      expect(spine.entries().map((e) => e.label)).toEqual(['1', '2', '3']);
      expect(spine.meta('p1')).toBeNull();
    });

    it('ignores uuids it does not hold', () => {
      const spine = seeded(2);
      spine.remove(['nope']);
      expect(spine.length).toBe(2);
    });
  });

  describe('move', () => {
    it('moves a passage and reports where it went', () => {
      const spine = seeded(4);
      const result = spine.move('p3', 0);
      expect(result).toMatchObject({ moved: true, from: 3, to: 0 });
      expect(spine.uuids()).toEqual(['p3', 'p0', 'p1', 'p2']);
    });

    it('reports failure for an unknown passage', () => {
      expect(seeded(2).move('nope', 0).moved).toBe(false);
    });

    it('is a no-op when the position does not change', () => {
      const spine = seeded(3);
      expect(spine.move('p1', 1)).toMatchObject({
        moved: true,
        from: 1,
        to: 1,
      });
      expect(spine.uuids()).toEqual(['p0', 'p1', 'p2']);
    });
  });

  describe('renumberFrom', () => {
    it('rewrites only the labels that moved', () => {
      const spine = new Spine('work-1');
      spine.seed([meta('a', '1'), meta('b', '1'), meta('c', '3')]);
      expect(spine.renumberFrom(0)).toEqual([
        { uuid: 'b', from: '1', to: '2' },
      ]);
      expect(spine.meta('c')?.label).toBe('3');
    });

    it('touches no passage document', () => {
      // The point of the spine: renumbering a thousand-passage work reads and
      // writes strings only.
      const spine = seeded(1000);
      spine.insert(meta('new', '1'), 0);
      expect(spine.meta('p999')?.label).toBe('1001');
    });
  });

  it('applyLabels writes exact labels without renumbering', () => {
    const spine = seeded(3);
    spine.applyLabels([
      { uuid: 'p1', label: '7' },
      { uuid: 'p2', label: '9' },
    ]);
    expect(spine.entries().map((e) => e.label)).toEqual(['1', '7', '9']);
  });

  it('derives sort from position', () => {
    const spine = seeded(3);
    spine.move('p2', 0);
    expect(spine.sortOf('p2')).toBe(0);
    expect(spine.sortOf('p0')).toBe(1);
  });

  it('notifies observers of order and label changes', () => {
    const spine = seeded(2);
    const listener = jest.fn();
    const stop = spine.observe(listener);

    spine.insert(meta('new', '3'), 2);
    expect(listener).toHaveBeenCalled();

    listener.mockClear();
    spine.setLabel('p0', '9');
    expect(listener).toHaveBeenCalled();

    stop();
    listener.mockClear();
    spine.remove(['p0']);
    expect(listener).not.toHaveBeenCalled();
  });
});

describe('Spine renumbering at the head of a run', () => {
  // A removal or a move puts a different passage at the anchor position,
  // carrying the label it held elsewhere. Renumbering from that stale label
  // gets the whole run consistently wrong.
  it('renumbers after deleting the first passage', () => {
    const spine = seeded(4);
    spine.remove(['p0']);
    expect(spine.entries().map((e) => e.label)).toEqual(['1', '2', '3']);
  });

  it('renumbers after moving a passage to the head', () => {
    const spine = seeded(4);
    spine.move('p3', 0);
    expect(spine.uuids()).toEqual(['p3', 'p0', 'p1', 'p2']);
    expect(spine.entries().map((e) => e.label)).toEqual(['1', '2', '3', '4']);
  });

  it('renumbers after moving the first passage down', () => {
    const spine = seeded(4);
    spine.move('p0', 2);
    expect(spine.uuids()).toEqual(['p1', 'p2', 'p0', 'p3']);
    expect(spine.entries().map((e) => e.label)).toEqual(['1', '2', '3', '4']);
  });

  it('renumbers after a move in the middle of the run', () => {
    const spine = seeded(4);
    spine.move('p1', 2);
    expect(spine.uuids()).toEqual(['p0', 'p2', 'p1', 'p3']);
    expect(spine.entries().map((e) => e.label)).toEqual(['1', '2', '3', '4']);
  });

  it('reports the forced anchor label as a change, so undo can restore it', () => {
    const spine = seeded(3);
    const changes = spine.remove(['p0']);
    expect(changes).toContainEqual({ uuid: 'p1', from: '2', to: '1' });
  });
});
