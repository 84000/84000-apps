import { WorkDocument } from './work-document';
import { para, paraTexts, testSchema } from './schema.fixture';
import type { SpineSeed } from './spine';
import type { XmlElement, XmlText } from 'yjs';

const meta = (
  uuid: string,
  label: string,
  type = 'translation',
): SpineSeed => ({ uuid, label, type });

/** A work of `count` passages, each holding one paragraph of known text. */
const build = (count = 3) => {
  let next = 0;
  const work = new WorkDocument({
    workUuid: 'work-1',
    schema: testSchema,
    newUuid: () => `new-${next++}`,
  });
  work.seedSpine(
    Array.from({ length: count }, (_, i) => meta(`p${i}`, `${i + 1}`)),
  );
  Array.from({ length: count }, (_, i) =>
    work.store.create(`p${i}`, [para(`text ${i}`, `a${i}`)]),
  );
  return work;
};

/** Replace a passage's content. `seed` is a no-op once a document has any. */
const setContent = (
  work: WorkDocument,
  uuid: string,
  paras: ReturnType<typeof para>[],
) => work.store.ensure(uuid).replaceContent({ type: 'doc', content: paras });

/** The work as (label, text) pairs, in spine order. */
const shape = (work: WorkDocument) =>
  work.spine
    .entries()
    .map((entry) => [
      entry.label,
      paraTexts(work.store.ensure(entry.uuid).toJSON()).join('|'),
    ]);

describe('WorkDocument structural ops', () => {
  describe('split', () => {
    it('leaves the head in place and puts the tail in a new passage', () => {
      const work = build(2);
      setContent(work, 'p0', [para('one', 'a'), para('two', 'b')]);
      // Position 5: after the first paragraph (1 + 3 text + 1 = 5).
      const result = work.split('p0', 5);

      expect(result?.uuid).toBe('new-0');
      expect(work.spine.uuids()).toEqual(['p0', 'new-0', 'p1']);
      expect(paraTexts(work.store.ensure('p0').toJSON())).toEqual(['one']);
      expect(paraTexts(work.store.ensure('new-0').toJSON())).toEqual(['two']);
    });

    it('renumbers the labels below the split', () => {
      const work = build(3);
      work.split('p0', 0);
      expect(work.spine.entries().map((e) => e.label)).toEqual([
        '1',
        '2',
        '3',
        '4',
      ]);
    });

    it('returns null for an unknown passage', () => {
      expect(build(1).split('nope', 0)).toBeNull();
    });
  });

  describe('merge', () => {
    it('joins a passage into the one before it', () => {
      const work = build(3);
      const result = work.merge('p1');

      expect(result?.uuid).toBe('p0');
      expect(work.spine.uuids()).toEqual(['p0', 'p2']);
      expect(paraTexts(work.store.ensure('p0').toJSON())).toEqual([
        'text 0',
        'text 1',
      ]);
    });

    it('reports where the two joined', () => {
      const work = build(2);
      const before = work.store.ensure('p0').toNode().content.size;
      expect(work.merge('p1')?.boundary).toBe(before);
    });

    it('refuses to merge the first passage', () => {
      expect(build(2).merge('p0')).toBeNull();
    });
  });

  describe('insert', () => {
    it('inserts a passage with a derived label', () => {
      const work = build(3);
      const { uuid } = work.insert({ type: 'translation' }, 1);
      expect(work.spine.uuids()).toEqual(['p0', uuid, 'p1', 'p2']);
      expect(work.spine.meta(uuid)?.label).toBe('2');
      expect(work.spine.entries().map((e) => e.label)).toEqual([
        '1',
        '2',
        '3',
        '4',
      ]);
    });

    it('labels the first passage 1 when there is nothing above it', () => {
      const work = build(0);
      const { uuid } = work.insert({ type: 'translation' }, 0);
      expect(work.spine.meta(uuid)?.label).toBe('1');
    });

    it('gives an empty passage a paragraph to type into', () => {
      const work = build(1);
      const { uuid } = work.insert({ type: 'translation' }, 1);
      expect(work.store.ensure(uuid).toJSON().content).toHaveLength(1);
    });
  });

  describe('remove', () => {
    it('deletes passages and renumbers', () => {
      const work = build(4);
      expect(work.remove(['p1', 'p2'])).toBe(true);
      expect(work.spine.uuids()).toEqual(['p0', 'p3']);
      expect(work.spine.entries().map((e) => e.label)).toEqual(['1', '2']);
    });

    it('reports failure when nothing matched', () => {
      expect(build(2).remove(['nope'])).toBe(false);
    });
  });

  describe('deleteRange', () => {
    it('trims the ends and drops everything between', () => {
      const work = build(4);
      setContent(work, 'p0', [para('keep', 'a'), para('drop', 'b')]);
      setContent(work, 'p3', [para('gone', 'c'), para('stay', 'd')]);

      // From after "keep" in p0, to before "stay" in p3.
      expect(work.deleteRange('p0', 6, 'p3', 6)).toBe(true);

      expect(work.spine.uuids()).toEqual(['p0', 'p3']);
      expect(paraTexts(work.store.ensure('p0').toJSON())).toEqual(['keep']);
      expect(paraTexts(work.store.ensure('p3').toJSON())).toEqual(['stay']);
    });

    it('normalizes a backwards range', () => {
      const work = build(3);
      expect(work.deleteRange('p2', 1, 'p0', 1)).toBe(true);
      expect(work.spine.uuids()).toEqual(['p0', 'p2']);
    });

    it('refuses a range inside one passage', () => {
      expect(build(2).deleteRange('p0', 1, 'p0', 3)).toBe(false);
    });
  });

  describe('reorder', () => {
    it('moves a passage and renumbers', () => {
      const work = build(4);
      expect(work.reorder('p3', 0)).toBe(true);
      expect(work.spine.uuids()).toEqual(['p3', 'p0', 'p1', 'p2']);
      expect(work.spine.entries().map((e) => e.label)).toEqual([
        '1',
        '2',
        '3',
        '4',
      ]);
    });
  });
});

describe('WorkDocument undo', () => {
  it('undoes and redoes a split atomically across docs and the spine', () => {
    const work = build(2);
    setContent(work, 'p0', [para('one', 'a'), para('two', 'b')]);
    const before = shape(work);

    work.split('p0', 5);
    expect(work.spine.length).toBe(3);

    expect(work.undo()).toEqual({ uuid: 'p0', where: 5 });
    expect(work.spine.uuids()).toEqual(['p0', 'p1']);
    expect(shape(work)).toEqual(before);

    expect(work.redo()).toEqual({ uuid: 'new-0', where: 'start' });
    expect(work.spine.uuids()).toEqual(['p0', 'new-0', 'p1']);
    expect(paraTexts(work.store.ensure('p0').toJSON())).toEqual(['one']);
    expect(paraTexts(work.store.ensure('new-0').toJSON())).toEqual(['two']);
  });

  it('undoes and redoes a merge', () => {
    const work = build(3);
    const before = shape(work);

    work.merge('p1');
    expect(work.undo()).toEqual({ uuid: 'p1', where: 'start' });
    expect(shape(work)).toEqual(before);

    work.redo();
    expect(work.spine.uuids()).toEqual(['p0', 'p2']);
    expect(paraTexts(work.store.ensure('p0').toJSON())).toEqual([
      'text 0',
      'text 1',
    ]);
  });

  it('undoes an insert', () => {
    const work = build(3);
    const before = shape(work);
    const { uuid } = work.insert({ type: 'translation' }, 1);

    work.undo();
    expect(work.spine.indexOf(uuid)).toBe(-1);
    expect(shape(work)).toEqual(before);
  });

  it('undoes a delete, restoring content and position', () => {
    const work = build(4);
    const before = shape(work);

    work.remove(['p1', 'p2']);
    work.undo();

    expect(work.spine.uuids()).toEqual(['p0', 'p1', 'p2', 'p3']);
    expect(shape(work)).toEqual(before);
  });

  it('undoes a cross-passage delete in one step', () => {
    const work = build(4);
    setContent(work, 'p0', [para('keep', 'a'), para('drop', 'b')]);
    setContent(work, 'p3', [para('gone', 'c'), para('stay', 'd')]);
    const before = shape(work);

    work.deleteRange('p0', 6, 'p3', 6);
    expect(work.spine.length).toBe(2);

    work.undo();
    expect(work.spine.uuids()).toEqual(['p0', 'p1', 'p2', 'p3']);
    expect(shape(work)).toEqual(before);
  });

  it('undoes a reorder', () => {
    const work = build(4);
    const before = shape(work);
    work.reorder('p3', 0);
    work.undo();
    expect(shape(work)).toEqual(before);
  });

  it('does not record its own replay', () => {
    const work = build(3);
    work.split('p0', 0);
    expect(work.log.depth).toBe(1);

    work.undo();
    expect(work.log.depth).toBe(0);
    expect(work.log.redoDepth).toBe(1);

    // A second undo must find nothing, not the inverse it just applied.
    expect(work.undo()).toBeNull();
  });

  it('interleaves text and structural undo in one order', () => {
    const work = build(3);
    const doc = work.store.ensure('p2');

    doc.doc.transact(() => doc.content.delete(0, doc.content.length));
    work.recordTextEdit('p2');
    work.merge('p1');

    // Structural first — it happened last.
    expect(work.undo()).toEqual({ uuid: 'p1', where: 'start' });
    expect(work.spine.length).toBe(3);

    // Then the text edit, in that passage's own history.
    expect(work.undo()).toEqual({ uuid: 'p2', where: 'end' });
    expect(paraTexts(doc.toJSON())).toEqual(['text 2']);

    expect(work.undo()).toBeNull();
  });

  it('skips a text entry whose passage was released rather than stalling', () => {
    const work = build(3);
    const doc = work.store.ensure('p2');
    doc.doc.transact(() => doc.content.delete(0, doc.content.length));
    work.recordTextEdit('p2');
    work.merge('p1');
    work.undo();

    // Releasing p2 takes its text history with it.
    doc.markSynced();
    expect(work.store.release('p2')).toBe(true);

    expect(work.undo()).toBeNull();
    expect(work.log.depth).toBe(0);
  });

  it('returns null with nothing to undo', () => {
    expect(build(2).undo()).toBeNull();
    expect(build(2).redo()).toBeNull();
  });
});

describe('WorkDocument structural undo over text history', () => {
  /**
   * A text edit as the passage's own UndoManager sees one. `PassageDoc`
   * defaults to tracking writes carrying no origin, which is what a direct
   * transaction produces.
   */
  const typeInto = (work: WorkDocument, uuid: string, text: string) => {
    const doc = work.store.ensure(uuid);
    doc.doc.transact(() => {
      const paragraph = doc.content.get(0) as XmlElement;
      (paragraph.get(0) as XmlText).insert(0, text);
    });
    work.recordTextEdit(uuid);
  };

  // Regression. `replaceContent` used to clear the fragment and rebuild it,
  // which destroyed the Yjs items the passage's UndoManager held in its stack.
  // Undoing a structural op and then the text edit beneath it therefore
  // applied a stack item to items that no longer existed: Yjs reported
  // success, the entry was consumed, and the edit stayed put.
  it('restores a text edit undone beneath a merge', () => {
    const work = build(3);
    typeInto(work, 'p0', 'edited ');
    work.merge('p1');
    expect(paraTexts(work.store.ensure('p0').toJSON())).toEqual([
      'edited text 0',
      'text 1',
    ]);

    work.undo(); // the merge
    expect(paraTexts(work.store.ensure('p0').toJSON())).toEqual([
      'edited text 0',
    ]);

    work.undo(); // the typing beneath it
    expect(paraTexts(work.store.ensure('p0').toJSON())).toEqual(['text 0']);
  });

  it('restores a text edit undone beneath a split', () => {
    const work = build(2);
    typeInto(work, 'p0', 'edited ');
    // Position 15: the end of 'edited text 0' plus the paragraph's own tokens.
    work.split('p0', 15);

    work.undo(); // the split
    work.undo(); // the typing beneath it

    expect(paraTexts(work.store.ensure('p0').toJSON())).toEqual(['text 0']);
  });

  it('leaves untouched passages alone when replacing content', () => {
    const work = build(3);
    const doc = work.store.ensure('p1');
    const before = doc.content.get(0);

    // Replacing with identical content must be a no-op on the Yjs items, or
    // every command-log replay would invalidate history it never touched.
    doc.replaceContent(doc.toJSON());

    expect(doc.content.get(0)).toBe(before);
  });
});
