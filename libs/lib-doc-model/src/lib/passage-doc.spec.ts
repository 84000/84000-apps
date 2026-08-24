import { encodeStateAsUpdate } from 'yjs';
import { PassageDoc } from './passage-doc';
import { para, paraTexts, testSchema } from './schema.fixture';

const build = (uuid = 'p1') =>
  new PassageDoc({ uuid, workUuid: 'work-1', schema: testSchema });

describe('PassageDoc', () => {
  it('seeds from row content', () => {
    const doc = build();
    doc.seed([para('hello', 'a'), para('world', 'b')]);
    expect(paraTexts(doc.toJSON())).toEqual(['hello', 'world']);
    expect(doc.text).toBe('helloworld');
  });

  it('seeds an empty passage with a single empty paragraph', () => {
    const doc = build();
    doc.seed([]);
    expect(doc.toJSON().content).toHaveLength(1);
  });

  it('ignores a second seed', () => {
    const doc = build();
    doc.seed([para('first', 'a')]);
    doc.seed([para('second', 'b')]);
    expect(paraTexts(doc.toJSON())).toEqual(['first']);
  });

  it('falls back to an empty paragraph on unparseable content', () => {
    const error = jest
      .spyOn(console, 'error')
      .mockImplementation(() => undefined);
    const doc = build();
    doc.seed([{ type: 'notARealNode' }]);
    expect(doc.toJSON().content).toHaveLength(1);
    expect(error).toHaveBeenCalled();
    error.mockRestore();
  });

  describe('dirty tracking', () => {
    it('is clean after seeding', () => {
      const doc = build();
      doc.seed([para('hello', 'a')]);
      expect(doc.isDirty).toBe(false);
    });

    it('becomes dirty on a structural content replacement', () => {
      const doc = build();
      doc.seed([para('hello', 'a')]);
      doc.replaceContent({ type: 'doc', content: [para('changed', 'a')] });
      expect(doc.isDirty).toBe(true);
    });

    it('stays clean when a remote update arrives', () => {
      const source = build();
      source.seed([para('remote', 'a')]);
      const target = build();
      target.applyRemote(encodeStateAsUpdate(source.doc));
      expect(paraTexts(target.toJSON())).toEqual(['remote']);
      expect(target.isDirty).toBe(false);
    });

    it('clears on markSynced', () => {
      const doc = build();
      doc.seed([para('hello', 'a')]);
      doc.replaceContent({ type: 'doc', content: [para('edited', 'a')] });
      doc.markSynced();
      expect(doc.isDirty).toBe(false);
    });

    it('notifies observers when it becomes dirty', () => {
      const doc = build();
      doc.seed([para('hello', 'a')]);
      const listener = jest.fn();
      doc.observe(listener);
      doc.replaceContent({ type: 'doc', content: [para('edited', 'a')] });
      expect(listener).toHaveBeenCalled();
    });
  });

  it('round-trips its state through an encoded update', () => {
    const source = build();
    source.seed([para('hello', 'a')]);
    const target = build();
    target.applyRemote(source.encode());
    expect(paraTexts(target.toJSON())).toEqual(['hello']);
  });

  it('keeps structural changes out of the text undo history', () => {
    const doc = build();
    doc.seed([para('hello', 'a')]);
    doc.replaceContent({ type: 'doc', content: [para('structural', 'a')] });
    // Structural writes are undone through the command log, never here.
    expect(doc.undo()).toBe(false);
    expect(paraTexts(doc.toJSON())).toEqual(['structural']);
  });

  it('undoes and redoes a tracked text edit', () => {
    const doc = build();
    doc.seed([para('hello', 'a')]);
    // A null-origin transaction is what a direct write produces, and is the
    // default tracked origin.
    doc.doc.transact(() => {
      doc.content.delete(0, doc.content.length);
    });
    expect(doc.toJSON().content).toBeUndefined();

    expect(doc.undo()).toBe(true);
    expect(paraTexts(doc.toJSON())).toEqual(['hello']);
    expect(doc.redo()).toBe(true);
    expect(doc.toJSON().content).toBeUndefined();
  });

  it('materializes a row from the spine identity', () => {
    const doc = build('passage-1');
    doc.seed([para('Homage to the Buddha.', 'ann-1')]);
    const passage = doc.toPassage({
      label: '1.2',
      sort: 4,
      type: 'translation',
    });
    expect(passage).toMatchObject({
      uuid: 'passage-1',
      workUuid: 'work-1',
      label: '1.2',
      sort: 4,
      type: 'translation',
      content: 'Homage to the Buddha.',
    });
    expect(passage.annotations).toContainEqual(
      expect.objectContaining({
        uuid: 'ann-1',
        type: 'paragraph',
        passageUuid: 'passage-1',
        start: 0,
        end: 'Homage to the Buddha.'.length,
      }),
    );
  });
});
