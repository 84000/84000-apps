import { MarkViewProps, mergeAttributes } from '@tiptap/react';
import { Editor } from '@tiptap/core';
import { HTMLElementType } from 'react';

/**
 * WeakMap to associate DOM elements with their editor instances.
 * Used by HoverCardProvider to find the correct editor for a hovered element.
 */
const editorElementMap = new WeakMap<HTMLElement, Editor>();

/**
 * Registers an editor for a DOM element.
 * Call this when creating mark/node views to enable hover card functionality.
 */
export const registerEditorElement = (element: HTMLElement, editor: Editor) => {
  editorElementMap.set(element, editor);
};

/**
 * Gets the editor associated with a DOM element.
 */
export const getEditorForElement = (
  element: HTMLElement,
): Editor | undefined => {
  return editorElementMap.get(element);
};

/**
 * Finds the range of a given mark in the editor's document by its reference.
 * Returns an object with 'from' and 'to' positions if found, otherwise undefined.
 */
export const findMarkRange = ({ editor, mark }: Partial<MarkViewProps>) => {
  if (!editor || !mark) {
    return undefined;
  }

  const { state } = editor;
  const { doc, tr } = state;

  let foundRange: { from: number; to: number } | undefined = undefined;

  const thisMark = mark;
  doc.descendants((node, pos) => {
    let foundMark = false;
    const from = tr.mapping.map(pos);
    const to = from + node.nodeSize;

    node.marks.forEach((m) => {
      if (m === thisMark) {
        foundMark = true;
        foundRange = { from, to };
        return;
      }
    });

    return !foundMark;
  });

  return foundRange;
};

/**
 * Finds a mark in the editor's document by its UUID attribute.
 * Returns an object with 'from', 'to', and 'mark' if found, otherwise undefined.
 */
export const findMarkByUuid = ({
  editor,
  uuid,
  markType,
  comparator = (mark, uuid) => mark.attrs.uuid === uuid,
}: {
  editor: {
    state: {
      doc: MarkViewProps['editor']['state']['doc'];
      tr: MarkViewProps['editor']['state']['tr'];
    };
  };
  uuid: string;
  markType: string;
  comparator?: (mark: MarkViewProps['mark'], uuid: string) => boolean;
}): { from: number; to: number; mark: MarkViewProps['mark'] } | undefined => {
  const { state } = editor;
  const { doc, tr } = state;

  let foundRange:
    | { from: number; to: number; mark: MarkViewProps['mark'] }
    | undefined = undefined;

  doc.descendants((node, pos) => {
    if (foundRange) return false;

    const from = tr.mapping.map(pos);
    const to = from + node.nodeSize;

    for (const m of node.marks) {
      if (m.type.name === markType && comparator(m, uuid)) {
        foundRange = { from, to, mark: m };
        return false;
      }
    }

    return true;
  });

  return foundRange;
};

export const findEndnoteMarkByUuid = ({
  editor,
  uuid,
}: {
  editor: {
    state: {
      doc: MarkViewProps['editor']['state']['doc'];
      tr: MarkViewProps['editor']['state']['tr'];
    };
  };
  uuid: string;
}): { from: number; to: number; mark: MarkViewProps['mark'] } | undefined => {
  return findMarkByUuid({
    editor,
    uuid,
    markType: 'endNoteLink',
    comparator: (mark, uuid) =>
      mark.attrs.notes?.some((note: { uuid: string }) => note.uuid === uuid),
  });
};

/**
 * Find a passage node in any editor by UUID.
 * Returns { pos, node } or undefined.
 */
export const findPassageNode = (
  editor: Editor,
  passageUuid: string,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
): { pos: number; node: any } | undefined => {
  const { doc } = editor.state;
  let result: { pos: number; node: typeof doc } | undefined;

  doc.descendants((node, pos) => {
    if (result) return false;
    if (node.type.name === 'passage' && node.attrs.uuid === passageUuid) {
      result = { pos, node };
      return false;
    }
    return true;
  });

  return result;
};

/**
 * Creates a function to update the attributes of a given HTML element.
 * The returned function takes an object of attributes and sets them on the element.
 */
export const createUpdateAttributes = (element: HTMLElement) => {
  return (attrs: { [key: string]: unknown }) => {
    Object.keys(attrs).forEach((key) => {
      element.setAttribute(key, attrs[key] as string);
    });
  };
};

/**
 * Creates a MarkView DOM element for a given mark and extension.
 * It sets up the element with merged attributes.
 */
export const createMarkViewDom = ({
  mark,
  extension,
  HTMLAttributes,
  element,
  className,
}: Partial<MarkViewProps> & {
  element: HTMLElementType;
  className?: string;
}) => {
  const dom = document.createElement(element);
  const updateElementAttributes = createUpdateAttributes(dom);

  const attributes = mergeAttributes(
    mark?.attrs || {},
    extension?.options.HTMLAttributes,
    HTMLAttributes || {},
    {
      class: className,
      type: extension?.name,
    },
  );

  updateElementAttributes(attributes);

  return { dom, updateAttributes: updateElementAttributes };
};
