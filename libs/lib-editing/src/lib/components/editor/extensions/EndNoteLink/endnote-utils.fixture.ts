import { Editor } from '@tiptap/core';
import { Node as ProseMirrorNode, Schema } from '@tiptap/pm/model';
import { EditorState, Transaction } from '@tiptap/pm/state';

/** Minimal passage schema with an `endNoteLink` mark. */
export const schema = new Schema({
  nodes: {
    doc: { content: 'passage+' },
    passage: {
      content: 'paragraph+',
      attrs: {
        uuid: { default: null },
        label: { default: null },
        sort: { default: 0 },
        type: { default: 'endnotes' },
        toh: { default: null },
      },
      toDOM: () => ['div', 0],
    },
    paragraph: {
      content: 'text*',
      toDOM: () => ['p', 0],
    },
    text: { group: 'inline' },
  },
  marks: {
    endNoteLink: {
      attrs: { notes: { default: undefined } },
      toDOM: () => ['span', 0],
    },
  },
});

type PassageSpec = {
  uuid: string;
  label: string;
  sort: number;
  type?: string;
  text?: string;
  /** Non-null on a per-text variant of a shared label slot. */
  toh?: string;
};

/** A passage node in the fixture schema; `type` defaults to `endnotes`. */
export const passageNode = ({
  uuid,
  label,
  sort,
  type,
  text,
  toh,
}: PassageSpec) =>
  schema.node(
    'passage',
    { uuid, label, sort, type: type ?? 'endnotes', toh: toh ?? null },
    [schema.node('paragraph', null, text ? [schema.text(text)] : [])],
  );

/**
 * A stand-in for a TipTap editor: `insertEndnotePassage` and friends only need
 * `state`, `view.dispatch` and `isDestroyed`, and a real editor would drag in
 * the whole extension stack plus a DOM.
 */
export const createEditor = (passages: PassageSpec[]) => {
  let state = EditorState.create({
    schema,
    doc: schema.node('doc', null, passages.map(passageNode)),
  });
  const dispatched: Transaction[] = [];

  const editor = {
    isDestroyed: false,
    get state() {
      return state;
    },
    view: {
      dispatch: (tr: Transaction) => {
        dispatched.push(tr);
        state = state.apply(tr);
      },
    },
  };

  return {
    editor: editor as unknown as Editor,
    dispatched,
    /** Every passage in doc order, as `[label, sort, uuid]` triples. */
    passages: () => {
      const rows: Array<[string, number, string]> = [];
      state.doc.descendants((node: ProseMirrorNode) => {
        if (node.type.name === 'passage') {
          rows.push([node.attrs.label, node.attrs.sort, node.attrs.uuid]);
        }
        return true;
      });
      return rows;
    },
    setDestroyed: () => {
      editor.isDestroyed = true;
    },
  };
};
