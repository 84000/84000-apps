import { WorkDocument } from './work-document';
import { para, testSchema } from './schema.fixture';
import { build, meta } from './work-document.fixture';
import type { RowOutline } from './types';

const order = (work: WorkDocument) => work.spine.uuids();
const parentOf = (work: WorkDocument, uuid: string) =>
  work.spine.meta(uuid)?.parent;

describe('WorkDocument.nest', () => {
  it('moves a run down, keeping its order', () => {
    const work = build(5);
    expect(work.nest(['p0', 'p1'], { to: 2 })).toBe(true);
    expect(order(work)).toEqual(['p2', 'p3', 'p0', 'p1', 'p4']);
  });

  it('moves a run up, keeping its order', () => {
    const work = build(5);
    expect(work.nest(['p2', 'p3'], { to: 0 })).toBe(true);
    expect(order(work)).toEqual(['p2', 'p3', 'p0', 'p1', 'p4']);
  });

  it('clamps a move past the end', () => {
    const work = build(4);
    work.nest(['p0', 'p1'], { to: 10 });
    expect(order(work)).toEqual(['p2', 'p3', 'p0', 'p1']);
  });

  it('refuses a run that is not contiguous', () => {
    const work = build(4);
    expect(work.nest(['p0', 'p2'], { to: 1 })).toBe(false);
    expect(order(work)).toEqual(['p0', 'p1', 'p2', 'p3']);
  });

  it('sets and clears parents', () => {
    const work = build(3);
    work.nest(['p1'], { parents: [{ uuid: 'p1', parent: 'p0' }] });
    expect(parentOf(work, 'p1')).toBe('p0');
    work.nest(['p1'], { parents: [{ uuid: 'p1' }] });
    expect(parentOf(work, 'p1')).toBeUndefined();
  });

  it('records nothing when nothing changes', () => {
    const work = build(3);
    expect(work.nest(['p1'], { to: 1, parents: [{ uuid: 'p1' }] })).toBe(false);
    expect(work.log.depth).toBe(0);
  });

  it('undoes and redoes a move and a re-parent as one step', () => {
    const work = build(4);
    work.nest(['p0', 'p1'], {
      to: 2,
      parents: [{ uuid: 'p0', parent: 'p3' }],
    });

    expect(work.undo()).toEqual({ uuid: 'p0', where: 'start' });
    expect(order(work)).toEqual(['p0', 'p1', 'p2', 'p3']);
    expect(parentOf(work, 'p0')).toBeUndefined();

    work.redo();
    expect(order(work)).toEqual(['p2', 'p3', 'p0', 'p1']);
    expect(parentOf(work, 'p0')).toBe('p3');
  });
});

describe('WorkDocument with an outline', () => {
  /** Labels by position; each row nests under the one before it. */
  const outline: RowOutline = (entries) =>
    new Map(
      entries.map((entry, i) => [
        entry.uuid,
        {
          label: `n.${i + 1}`,
          ...(i ? { parent: entries[i - 1].uuid, depth: 1 } : {}),
        },
      ]),
    );

  const outlined = () => {
    let next = 0;
    const work = new WorkDocument({
      workUuid: 'work-1',
      schema: testSchema,
      newUuid: () => `new-${next++}`,
      outline,
    });
    work.seedSpine(['a', 'b', 'c'].map((uuid) => meta(uuid, '')));
    ['a', 'b', 'c'].forEach((uuid) =>
      work.store.create(uuid, [para(`text ${uuid}`, `${uuid}-1`)]),
    );
    return work;
  };
  const labels = (work: WorkDocument) =>
    work.spine.entries().map((entry) => entry.label);

  it('derives labels and nesting once seeded', () => {
    const work = outlined();
    expect(labels(work)).toEqual(['n.1', 'n.2', 'n.3']);
    expect(work.spine.meta('b')).toMatchObject({ parent: 'a', depth: 1 });
    expect(work.spine.meta('a')?.parent).toBeUndefined();
  });

  it('re-derives them after a split, and again on undo', () => {
    const work = outlined();
    work.split('a', 0);
    expect(order(work)).toEqual(['a', 'new-0', 'b', 'c']);
    expect(labels(work)).toEqual(['n.1', 'n.2', 'n.3', 'n.4']);
    expect(parentOf(work, 'b')).toBe('new-0');

    work.undo();
    expect(labels(work)).toEqual(['n.1', 'n.2', 'n.3']);
    expect(parentOf(work, 'b')).toBe('a');
  });

  it('records no label changes of its own', () => {
    const work = outlined();
    work.remove(['a']);
    const command = work.log.peekUndo();
    expect(command && 'labels' in command && command.labels).toEqual([]);
    expect(labels(work)).toEqual(['n.1', 'n.2']);
    expect(work.spine.meta('b')?.depth).toBeUndefined();
  });
});
