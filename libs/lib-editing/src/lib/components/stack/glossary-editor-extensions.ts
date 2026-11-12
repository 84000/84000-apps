import { Extension, type Extensions } from '@tiptap/core';
import { Collaboration } from '@tiptap/extension-collaboration';
import {
  Fragment,
  Slice,
  type Mark,
  type Node as ProseMirrorNode,
} from '@tiptap/pm/model';
import { Plugin } from '@tiptap/pm/state';

import { BoundaryKeymap } from './BoundaryKeymap';
import { buildGlossarySchemaExtensions } from './glossary-extensions';
import { withMentionAuthoring } from './mention-authoring';
import type { StackEditorBinding } from './types';

/** What a definition keeps only as it was stored, never from a paste. */
const STORED_ONLY = new Set(['definitionMarkup', 'definitionPointer']);

const withoutStored = <T extends { attrs: Record<string, unknown> }>({
  attrs,
}: T) => ('stored' in attrs ? { ...attrs, stored: null } : attrs);

const pastedMarks = (marks: readonly Mark[]) =>
  marks
    .filter((mark) => !STORED_ONLY.has(mark.type.name))
    .map((mark) => mark.type.create(withoutStored(mark)));

/** Pasted nodes as the editor's own, with any wrapper's blocks lifted out. */
const pastedNodes = (fragment: Fragment): ProseMirrorNode[] => {
  const nodes: ProseMirrorNode[] = [];
  fragment.forEach((node) => {
    if (STORED_ONLY.has(node.type.name)) return;
    if (node.type.name === 'definitionWrapper') {
      nodes.push(...pastedNodes(node.content));
    } else if (node.isText) {
      nodes.push(node.mark(pastedMarks(node.marks)));
    } else {
      nodes.push(
        node.type.create(
          withoutStored(node),
          Fragment.from(pastedNodes(node.content)),
          pastedMarks(node.marks),
        ),
      );
    }
  });
  return nodes;
};

const hasWrapper = (fragment: Fragment) => {
  let found = false;
  fragment.descendants((node) => {
    if (node.type.name === 'definitionWrapper') found = true;
    return !found;
  });
  return found;
};

/**
 * Pasted content as the editor's own: the stored elements and TEI markup a
 * definition keeps from its import are not taken from a paste.
 */
export const plainPastedSlice = (slice: Slice): Slice => {
  const content = Fragment.from(pastedNodes(slice.content));
  if (!content.size) return Slice.empty;
  return hasWrapper(slice.content)
    ? Slice.maxOpen(content)
    : new Slice(content, slice.openStart, slice.openEnd);
};

const textOf = (slice: Slice) =>
  slice.content.textBetween(0, slice.content.size, '\n');

/**
 * What a glossary editor pastes: a slice copied, cut or dragged from a
 * definition comes back as it was, markup and all, so moving a cross-linked
 * name keeps its link. Anything else is pasted plain. The last slice taken
 * from any glossary editor is shared by all of them, and is recognized by its
 * text.
 */
export const glossaryClipboard = () => {
  let copied: Slice | null = null;
  return {
    transformCopied: (slice: Slice) => {
      copied = slice;
      return slice;
    },
    transformPasted: (slice: Slice, _view?: unknown, plain = false) =>
      !plain && copied && textOf(copied) === textOf(slice)
        ? copied
        : plainPastedSlice(slice),
  };
};

const clipboard = glossaryClipboard();

const PlainPaste = Extension.create({
  name: 'glossaryPlainPaste',

  addProseMirrorPlugins() {
    return [new Plugin({ props: clipboard })];
  },
});

/**
 * A live glossary row's editor, bound to its definition's document. The
 * definition is edited in place: rows are never split, merged or started from
 * it.
 */
export const buildGlossaryEditorExtensions = ({
  uuid,
  fragment,
  undoManager,
  delegate,
}: StackEditorBinding): Extensions => [
  ...withMentionAuthoring(buildGlossarySchemaExtensions()),
  Collaboration.configure({ fragment, yUndoOptions: { undoManager } }),
  BoundaryKeymap.configure({ uuid, delegate, restructure: false }),
  PlainPaste,
];
