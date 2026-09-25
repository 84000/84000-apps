import { Editor } from '@tiptap/core';
import type { JSONContent } from '@tiptap/core';
import { TextSelection } from '@tiptap/pm/state';
import type { WorkDocument } from '@eightyfourthousand/lib-doc-model';

import { createStackEndnote, deleteStackEndnote } from './stack-endnotes';
import { buildStackSchemaExtensions } from './stack-extensions';
import { createStackWorkDocument } from './stack-work';
import type { PassageStackController } from './PassageStackController';
import type { StackWork } from './StackWorkProvider';

// See PassageStackController.spec.ts — building the stack schema reaches
// `data-access/ssr` through two client barrels that leak it.
jest.mock('next/server', () => ({
  NextRequest: class {},
  NextResponse: class {},
}));
jest.mock('resend', () => ({ Resend: class {} }));

const para = (
  uuid: string,
  text: string,
  links: { endNote: string; label: string }[] = [],
): JSONContent => ({
  type: 'paragraph',
  attrs: { uuid },
  content: [
    {
      type: 'text',
      text,
      ...(links.length
        ? {
            marks: [
              {
                type: 'endNoteLink',
                attrs: {
                  notes: links.map((link) => ({
                    uuid: `link-${link.endNote}`,
                    ...link,
                  })),
                },
              },
            ],
          }
        : {}),
    },
  ],
});

/**
 * 1.1 links n.1; 1.2 has none. The endnotes n.1 and n.2 follow the body.
 */
const build = () => {
  const work = createStackWorkDocument({ workUuid: 'w1' });
  work.seedSpine([
    { uuid: 'b1', label: '1.1', type: 'translation' },
    { uuid: 'b2', label: '1.2', type: 'translation' },
    { uuid: 'n1', label: 'n.1', type: 'endnotes' },
    { uuid: 'n2', label: 'n.2', type: 'endnotes' },
  ]);
  work.store.create('b1', [
    para('b1p', 'first', [{ endNote: 'n1', label: 'n.1' }]),
  ]);
  work.store.create('b2', [para('b2p', 'second passage')]);
  work.store.create('n1', [para('n1p', 'note one')]);
  work.store.create('n2', [para('n2p', 'note two')]);
  ['b1', 'b2', 'n1', 'n2'].forEach((uuid) =>
    work.store.peek(uuid)?.markSynced(),
  );

  const endnotes = {
    revealPassage: jest.fn(async () => true),
    removePassage: jest.fn((uuid: string) => work.remove([uuid])),
  } as unknown as PassageStackController;
  const stack: StackWork = {
    work,
    controllerFor: (tab) => (tab === 'endnotes' ? endnotes : null),
  };
  return { work, stack, endnotes };
};

/** An editor over a passage's content, inside its row, with a selection. */
const editorFor = (
  work: WorkDocument,
  uuid: string,
  from: number,
  to: number,
) => {
  const row = document.createElement('div');
  row.dataset['stackPassage'] = uuid;
  const element = document.createElement('div');
  row.append(element);
  document.body.append(row);
  const editor = new Editor({
    element,
    extensions: buildStackSchemaExtensions(),
    content: work.store.ensure(uuid).toJSON(),
  });
  editor.view.dispatch(
    editor.state.tr.setSelection(
      TextSelection.create(editor.state.doc, from, to),
    ),
  );
  return editor;
};

/** Each link's endnote and label in a passage, in order. */
const linksIn = (work: WorkDocument, uuid: string) => {
  const found: string[] = [];
  work.store
    .ensure(uuid)
    .toNode()
    .descendants((node) => {
      node.marks.forEach((mark) =>
        (mark.attrs.notes as { endNote: string; label: string }[]).forEach(
          (note) =>
            found.push(
              `${note.endNote === 'n1' || note.endNote === 'n2' ? note.endNote : 'new'} ${note.label}`,
            ),
        ),
      );
      return true;
    });
  return found;
};

describe('createStackEndnote', () => {
  it('puts the note after the last one linked before the selection', async () => {
    const { work, stack } = build();
    // "second" in 1.2: the last link before it is 1.1's, to n.1.
    const editor = editorFor(work, 'b2', 1, 7);

    const result = await createStackEndnote({ stack, editor });

    expect(result).toEqual({ uuid: expect.any(String), label: 'n.2' });
    const uuid = (result as { uuid: string }).uuid;
    expect(work.spine.uuids()).toEqual(['b1', 'b2', 'n1', uuid, 'n2']);
    expect(work.spine.meta('n2')?.label).toBe('n.3');
    expect(linksIn(work, 'b2')).toEqual(['new n.2']);
    editor.destroy();
  });

  it('undoes the note and its link in one step', async () => {
    const { work, stack } = build();
    const editor = editorFor(work, 'b2', 1, 7);
    await createStackEndnote({ stack, editor });

    work.undo();

    expect(work.spine.uuids()).toEqual(['b1', 'b2', 'n1', 'n2']);
    expect(work.spine.meta('n2')?.label).toBe('n.2');
    expect(linksIn(work, 'b2')).toEqual([]);
    editor.destroy();
  });

  it('refuses when a passage before it is not held', async () => {
    const { work, stack } = build();
    work.store.release('b1');
    const editor = editorFor(work, 'b2', 1, 7);

    const result = await createStackEndnote({ stack, editor });

    expect(result).toEqual({
      error: expect.stringMatching(/Jump to the note/),
    });
    expect(work.spine.length).toBe(4);
    editor.destroy();
  });
});

describe('deleteStackEndnote', () => {
  it('deletes the endnote and the links to it', async () => {
    const { work, stack, endnotes } = build();

    expect(await deleteStackEndnote({ stack, endNote: 'n1' })).toBe(true);

    expect(endnotes.removePassage).toHaveBeenCalledWith('n1');
    expect(work.spine.uuids()).toEqual(['b1', 'b2', 'n2']);
    expect(linksIn(work, 'b1')).toEqual([]);
  });
});
