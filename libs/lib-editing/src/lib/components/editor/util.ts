import {
  MarkViewProps,
  mergeAttributes,
  NodeViewProps,
  NodeViewRendererProps,
} from '@tiptap/react';
import { HTMLElementType } from 'react';
import { v4 as uuidv4 } from 'uuid';

/**
 * Validates and updates the attributes of a Node.
 * Specifically, it ensures that the node has a unique 'uuid' attribute.
 * If the 'uuid' is missing or duplicates the previous node's 'uuid',
 * a new UUID is generated and assigned. In the case of duplication, all
 * global attributes are set to their default values.
 */
export const validateAttrs = async ({
  node,
  editor,
  getPos,
  updateAttributes,
}: Partial<NodeViewProps>) => {
  // wait for next tick to ensure node is rendered
  await Promise.resolve();

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
