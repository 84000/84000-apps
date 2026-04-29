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
import { Passage } from '@eightyfourthousand/data-access';

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
 * transaction that stamps a fresh UUID onto every node or mark that either:
 *   1. has uuid: null / undefined / empty, OR
 *   2. duplicates the UUID of another node/mark already seen in this walk.
 *
 * Block nodes are updated via tr.setNodeMarkup. Inline marks (Link,
 * InternalLink, GlossaryInstance) carry their own uuid attribute and are
 * updated via tr.removeMark + tr.addMark, since setNodeMarkup does not apply
 * to marks. This prevents duplicate annotation UUIDs when a passage is split
 * and the afterContent inherits copies of the original marks.
 *
 * It must be called (and awaited via a Promise.resolve()) before
 * passagesFromNodes() so that the transaction is committed to the editor state.
 */
// Parameter annotation UUID attributes that live on block node attrs (not marks)
// and must be deduplicated alongside the main `uuid` attribute.
const PARAMETER_UUID_ATTRS = ['leadingSpaceUuid', 'indentUuid'] as const;

export interface EnsureUuidsOptions {
  passageUuids?: Set<string>;
}

export const ensureUuids = (
  editor: Editor,
  options: EnsureUuidsOptions = {},
): void => {
  const { state, view } = editor;
  const { doc, tr } = state;
  const seen = new Set<string>();
  let changed = false;
  let activePassageUuid: string | undefined;
  const targetPassageUuids = options.passageUuids;

  doc.descendants((node, pos) => {
    // text and doc nodes never carry a uuid
    if (node.type.name === 'text' || node.type.name === 'doc') {
      return true;
    }

    if (node.type.name === 'passage') {
      activePassageUuid = node.attrs.uuid;
      if (node.attrs.uuid) {
        seen.add(node.attrs.uuid);
      }
      return !targetPassageUuids || targetPassageUuids.has(node.attrs.uuid);
    }

    if (targetPassageUuids && !activePassageUuid) {
      return false;
    }

    let newAttrs: Record<string, unknown> | null = null;

    // Check main uuid
    const existing: string | null | undefined = node.attrs.uuid;
    if (!existing || seen.has(existing)) {
      newAttrs = { ...node.attrs, uuid: uuidv4() };
      seen.add(newAttrs.uuid as string);
    } else {
      seen.add(existing);
    }

    // Check parameter annotation UUIDs
    for (const attrKey of PARAMETER_UUID_ATTRS) {
      const existingParam = node.attrs[attrKey] as string | null | undefined;
      if (existingParam === undefined) continue; // node type doesn't use this attr
      if (!existingParam || seen.has(existingParam)) {
        newAttrs = { ...(newAttrs ?? node.attrs), [attrKey]: uuidv4() };
        seen.add(newAttrs[attrKey] as string);
      } else {
        seen.add(existingParam);
      }
    }

    if (newAttrs) {
      tr.setNodeMarkup(pos, undefined, newAttrs);
      changed = true;
    }

    return true;
  });

  // Second pass: walk text nodes and fix marks that carry a uuid attribute
  // (Link, InternalLink, GlossaryInstance). doc.descendants does not expose
  // marks directly, so we must walk text nodes to find them.
  doc.descendants((node, pos) => {
    if (node.type.name !== 'text' || node.marks.length === 0) return true;

    if (targetPassageUuids) {
      let nodeInTargetPassage = false;
      const $pos = doc.resolve(pos);
      for (let depth = $pos.depth; depth >= 0; depth--) {
        const parent = $pos.node(depth);
        if (
          parent.type.name === 'passage' &&
          targetPassageUuids.has(parent.attrs.uuid)
        ) {
          nodeInTargetPassage = true;
          break;
        }
      }
      if (!nodeInTargetPassage) {
        return true;
      }
    }

    for (const mark of node.marks) {
      const existing: string | null | undefined = mark.attrs.uuid;
      if (existing === undefined) continue; // mark type has no uuid attribute

      const isDuplicate = existing ? seen.has(existing) : false;
      if (!existing || isDuplicate) {
        const newUuid = uuidv4();
        const newMark = mark.type.create({ ...mark.attrs, uuid: newUuid });
        // pos is the start of the text node; the mark spans the full text node
        tr.removeMark(pos, pos + node.nodeSize, mark.type);
        tr.addMark(pos, pos + node.nodeSize, newMark);
        seen.add(newUuid);
        changed = true;
      } else {
        seen.add(existing);
      }
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
