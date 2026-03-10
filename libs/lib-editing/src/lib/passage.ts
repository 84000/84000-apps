import { Editor } from '@tiptap/react';
import { Node } from '@tiptap/pm/model';
import { v4 as uuidv4 } from 'uuid';
import {
  annotationExportsFromNode,
  markAnnotationFromNode,
  parameterAnnotationFromNode,
} from './exporters';
import { findNodePosition, nodeNotFound } from './exporters/util';
import { ExporterContext } from './exporters/export';
import { Passage } from '@data-access';

/**
 * Ensures every node in the editor document has a unique, non-null UUID.
 *
 * UUID assignment normally happens asynchronously in NodeView lifecycle hooks
 * (validateAttrs / createNodeViewDom). When save() is called shortly after a
 * structural edit (e.g. pressing Enter to create a new paragraph, or splitting
 * a passage), some nodes may still carry uuid: null or a UUID duplicated from
 * the node they were split from.  passagesFromNodes() then reads those nodes
 * synchronously, and annotationExportsFromNode silently skips any node whose
 * uuid is falsy — producing missing paragraph annotations.
 *
 * This function walks the document synchronously and dispatches a single
 * transaction that stamps a fresh UUID onto every node that either:
 *   1. has uuid: null / undefined / empty, OR
 *   2. duplicates the UUID of another node already seen in this walk.
 *
 * It must be called (and awaited via a Promise.resolve()) before
 * passagesFromNodes() so that the transaction is committed to the editor state.
 */
export const ensureUuids = (editor: Editor): void => {
  const { state, view } = editor;
  const { doc, tr } = state;
  const seen = new Set<string>();
  let changed = false;

  doc.descendants((node, pos) => {
    // text and doc nodes never carry a uuid
    if (node.type.name === 'text' || node.type.name === 'doc') {
      return true;
    }

    const existing: string | null | undefined = node.attrs.uuid;
    const isDuplicate = existing ? seen.has(existing) : false;

    if (!existing || isDuplicate) {
      const newUuid = uuidv4();
      tr.setNodeMarkup(pos, undefined, {
        ...node.attrs,
        uuid: newUuid,
      });
      seen.add(newUuid);
      changed = true;
    } else {
      seen.add(existing);
    }

    return true;
  });

  if (changed) {
    view.dispatch(tr);
  }
};

export const passageFromNode = (node: Node, workUuid: string): Passage => {
  const uuid = node.attrs.uuid;
  const type = node.attrs.type;
  const toh = node.attrs.toh;

  const ctx: ExporterContext = {
    passageUuid: uuid,
    node,
    parent: node,
    root: node,
    start: 0,
  };
  const annotations = [
    ...parameterAnnotationFromNode(ctx),
    ...markAnnotationFromNode(ctx),
  ];
  node.content.forEach((child) => {
    const start = findNodePosition(node, child.attrs.uuid, child.type.name);
    if (start === undefined) {
      return nodeNotFound(child);
    }
    annotations.push(
      ...annotationExportsFromNode({
        passageUuid: uuid,
        node: child,
        parent: node,
        root: node,
        start,
      }),
    );
  });

  const passage: Passage = {
    uuid,
    type,
    workUuid,
    sort: node.attrs.sort,
    label: node.attrs.label,
    content: node.textContent,
    toh,
    annotations,
  };
  return passage;
};

export const passagesFromNodes = ({
  uuids,
  workUuid,
  editor,
}: {
  uuids: string[];
  workUuid: string;
  editor: Editor;
}): Passage[] => {
  const passages: Passage[] = [];
  uuids.forEach((uuid) => {
    const node = editor.$node('passage', { uuid });
    if (!node) {
      console.warn(`No passage node found for uuid: ${uuid}`);
      return;
    }

    passages.push(passageFromNode(node.node, workUuid));
  });
  return passages;
};
