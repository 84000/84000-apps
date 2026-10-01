import { Schema } from '@tiptap/pm/model';
import { WorkDocument } from './work-document';
import { para } from './schema.fixture';
import { meta } from './work-document.fixture';

describe('deleting an endnote', () => {
  const schema = new Schema({
    nodes: {
      doc: { content: 'block+' },
      paragraph: {
        group: 'block',
        content: 'inline*',
        attrs: { uuid: { default: null } },
        toDOM: () => ['p', 0],
      },
      text: { group: 'inline' },
    },
    marks: {
      endNoteLink: {
        attrs: { notes: { default: [] } },
        toDOM: () => ['sup', 0],
      },
    },
  });

  const note = (endNote: string) => ({ uuid: `link-${endNote}`, endNote });

  /** A body passage whose word "linked" carries links to the given endnotes. */
  const build = (...endNotes: string[]) => {
    const work = new WorkDocument({ workUuid: 'work-1', schema });
    // With sorts, as saved passages have: a delete of one is what the save
    // has to carry out.
    work.seedSpine([
      { ...meta('body', '1.1'), sort: 1 },
      { ...meta('n0', 'n.1', 'endnotes'), sort: 2 },
      { ...meta('n1', 'n.2', 'endnotes'), sort: 3 },
      { ...meta('n2', 'n.3', 'endnotes'), sort: 4 },
    ]);
    work.store.create('body', [
      {
        type: 'paragraph',
        attrs: { uuid: 'para' },
        content: [
          { type: 'text', text: 'a ' },
          {
            type: 'text',
            text: 'linked',
            marks: [
              { type: 'endNoteLink', attrs: { notes: endNotes.map(note) } },
            ],
          },
          { type: 'text', text: ' word' },
        ],
      },
    ]);
    work.store.create('n1', [para('first note', 'x1')]);
    work.store.create('n2', [para('second note', 'x2')]);
    return work;
  };

  const links = (work: WorkDocument) => {
    const found: string[] = [];
    work.store
      .ensure('body')
      .toNode()
      .descendants((node) => {
        node.marks.forEach((mark) =>
          (mark.attrs.notes as { endNote: string }[]).forEach((n) =>
            found.push(n.endNote),
          ),
        );
        return true;
      });
    return found;
  };

  it('removes the links to it and keeps the others at that position', () => {
    const work = build('n1', 'n2');
    work.remove(['n1']);
    expect(links(work)).toEqual(['n2']);
    expect(work.store.ensure('body').text).toBe('a linked word');
    expect(work.store.ensure('body').isDirty).toBe(true);
  });

  it('removes the mark when no link is left, and joins the text', () => {
    const work = build('n1');
    work.remove(['n1']);
    expect(links(work)).toEqual([]);
    expect(work.store.ensure('body').toNode().child(0).childCount).toBe(1);
  });

  const labels = (work: WorkDocument, uuid = 'body') => {
    const found: string[] = [];
    work.store
      .ensure(uuid)
      .toNode()
      .descendants((node) => {
        node.marks.forEach((mark) =>
          (mark.attrs.notes as { label?: string }[]).forEach((n) =>
            found.push(n.label ?? ''),
          ),
        );
        return true;
      });
    return found;
  };

  it('renumbers the links to the endnotes after it, without an edit', () => {
    const work = build('n2');
    work.store.ensure('body').markSynced();
    work.remove(['n1']);
    expect(work.spine.meta('n2')?.label).toBe('n.2');
    expect(labels(work)).toEqual(['n.2']);
    expect(work.store.ensure('body').isDirty).toBe(false);

    work.undo();
    expect(labels(work)).toEqual(['n.3']);
  });

  it('numbers the links of a passage loaded after a renumbering', () => {
    const work = build();
    work.remove(['n1']);
    work.store.create('later', [
      {
        type: 'paragraph',
        attrs: { uuid: 'later-para' },
        content: [
          {
            type: 'text',
            text: 'stale',
            marks: [
              {
                type: 'endNoteLink',
                attrs: { notes: [{ ...note('n2'), label: 'n.3' }] },
              },
            ],
          },
        ],
      },
    ]);
    expect(labels(work, 'later')).toEqual(['n.2']);
    expect(work.store.ensure('later').isDirty).toBe(false);
  });

  it('adds an endnote and a link to it in one command', () => {
    // body links n.3; a new note goes after n.1 and takes n.2.
    const work = build('n2');
    const body = work.store.ensure('body');
    const linked = body.toJSON();
    const text = linked.content?.[0].content ?? [];
    text[0] = {
      ...text[0],
      marks: [
        {
          type: 'endNoteLink',
          attrs: {
            notes: [{ uuid: 'link-new', endNote: 'new', label: 'n.2' }],
          },
        },
      ],
    };
    work.insert(
      { uuid: 'new', type: 'endnotes', label: 'n.2' },
      work.spine.indexOf('n0') + 1,
      { alongWith: [{ uuid: 'body', after: linked }] },
    );

    expect(work.spine.meta('n2')?.label).toBe('n.4');
    expect(labels(work)).toEqual(['n.2', 'n.4']);

    work.undo();
    expect(work.spine.uuids()).toEqual(['body', 'n0', 'n1', 'n2']);
    expect(links(work)).toEqual(['n2']);
    expect(labels(work)).toEqual(['n.3']);
  });

  // A replace rewrites the body on the server; undoing the earlier delete
  // must not write the body's pre-replace content back.
  it('drops history that would undo a server rewrite', () => {
    const work = build('n1');
    work.remove(['n1']);
    work.store.ensure('body').markSynced();

    work.adoptServerContent([
      {
        uuid: 'body',
        content: [
          {
            type: 'paragraph',
            attrs: { uuid: 'para' },
            content: [{ type: 'text', text: 'replaced' }],
          },
        ],
      },
    ]);
    work.undo();

    expect(work.store.ensure('body').text).toBe('replaced');
    expect(work.store.ensure('body').isDirty).toBe(false);
  });

  it('takes links to a deleted endnote out of a passage loaded afterwards', () => {
    const work = build();
    work.store.release('body');
    work.remove(['n1']);

    work.store.create('body', [
      {
        type: 'paragraph',
        attrs: { uuid: 'para' },
        content: [
          {
            type: 'text',
            text: 'linked',
            marks: [{ type: 'endNoteLink', attrs: { notes: [note('n1')] } }],
          },
        ],
      },
    ]);

    expect(links(work)).toEqual([]);
  });

  it('puts the endnote and its links back in one undo', () => {
    const work = build('n1', 'n2');
    work.remove(['n1']);
    work.undo();
    expect(work.spine.uuids()).toEqual(['body', 'n0', 'n1', 'n2']);
    expect(links(work)).toEqual(['n1', 'n2']);
    work.redo();
    expect(links(work)).toEqual(['n2']);
  });
});
