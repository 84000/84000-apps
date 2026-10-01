import type { XmlElement, XmlText } from 'yjs';
import { WorkDocument } from './work-document';
import { para, paraTexts } from './schema.fixture';
import { build, setContent, shape } from './work-document.fixture';

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

  it('undoes a whole-passage delete in one step', () => {
    const work = build(4);
    setContent(work, 'p0', [para('keep', 'a'), para('drop', 'b')]);
    const before = shape(work);

    work.replacePassages(['p1', 'p2']);
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

  // Typing on either side of a command lands within the UndoManager's
  // capture window, as when a link is made from the keyboard.
  it('keeps typing after a command apart from typing before it', () => {
    const work = build(2);
    const doc = work.store.ensure('p0');
    // Logged as the stack logs them: only a new stack item is a new entry.
    doc.undoManager.on('stack-item-added', ({ type }: { type: string }) => {
      if (type === 'undo') work.recordTextEdit('p0');
    });
    const type = (text: string) =>
      doc.doc.transact(() => {
        const paragraph = doc.content.get(0) as XmlElement;
        (paragraph.get(0) as XmlText).insert(0, text);
      });
    const texts = () => paraTexts(doc.toJSON());

    type('a ');
    work.insert({ uuid: 'n', type: 'endnotes', label: 'n.1' }, 2, {
      alongWith: [
        {
          uuid: 'p0',
          after: {
            type: 'doc',
            content: [para('a text 0', 'a0'), para('note', 'x')],
          },
        },
      ],
    });
    type('b ');

    work.undo();
    expect(texts()).toEqual(['a text 0', 'note']);
    work.undo();
    expect(texts()).toEqual(['a text 0']);
    expect(work.spine.uuids()).toEqual(['p0', 'p1']);
    work.undo();
    expect(texts()).toEqual(['text 0']);

    work.redo();
    work.redo();
    work.redo();
    expect(texts()).toEqual(['b a text 0', 'note']);
  });
});
