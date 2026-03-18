import {
  MarkViewProps,
  mergeAttributes,
  NodeViewProps,
  NodeViewRendererProps,
} from '@tiptap/react';
import { Editor } from '@tiptap/core';
import { HTMLElementType } from 'react';
import { v4 as uuidv4 } from 'uuid';

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
 * Validates and updates the attributes of a Node.
 * Specifically, it ensures that the node has a unique 'uuid' attribute.
 * If the 'uuid' is missing or duplicates the previous node's 'uuid',
 * a new UUID is generated and assigned. In the case of duplication, all
 * global attributes are set to their default values.
 */
export const validateAttrs = ({
  node,
  editor,
  getPos,
  updateAttributes,
}: Partial<NodeViewProps>) => {
  if (!node?.attrs.uuid) {
    updateAttributes?.({ uuid: uuidv4() });
    return;
  }

  const pos = getPos?.();
  if (pos === null || pos === undefined) {
    return;
  }

  // check if previous node has same uuid, if so, set a new one
  const $pos = editor?.state.doc.resolve(pos);
  const parent = $pos?.parent;
  const index = $pos?.index();
  if (!parent || index === null || index === undefined) {
    return;
  }

  if (index > 0 && parent.child(index - 1).attrs.uuid === node.attrs.uuid) {
    const attrs: { [attr: string]: unknown } = {
      ...node.attrs,
      uuid: uuidv4(),
    };

    // reset all global attributes to default values
    if (attrs.leadingSpaceUuid) {
      attrs.leadSpaceUuid = undefined;
    }

    if (attrs.hasLeadingSpace) {
      attrs.hasLeadingSpace = false;
    }

    if (attrs.indentUuid) {
      attrs.indentUuid = undefined;
    }

    if (attrs.hasIndent) {
      attrs.hasIndent = false;
    }

    if (attrs.hasParagraphIndent) {
      attrs.hasParagraphIndent = false;
    }

    updateAttributes?.(attrs);
  }
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
      mark.attrs.notes?.find((note: { uuid: string }) => note.uuid === uuid),
  });
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
 * Creates a NodeView DOM element for a given node and extension.
 * It sets up the element with merged attributes and validates them.
 */
export const createNodeViewDom = ({
  editor,
  getPos,
  node,
  extension,
  HTMLAttributes,
  element,
  className,
}: Partial<NodeViewRendererProps> & {
  element: HTMLElementType;
  className?: string;
}) => {
  const dom = document.createElement(element);
  const updateAttributes = createUpdateAttributes(dom);

  const attributes = mergeAttributes(
    node?.attrs || {},
    extension?.options.HTMLAttributes,
    HTMLAttributes || {},
    {
      class: className,
      type: extension?.name,
    },
  );

  updateAttributes(attributes);

  validateAttrs({
    node,
    editor,
    getPos,
    updateAttributes,
  });

  return { dom, updateAttributes };
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
