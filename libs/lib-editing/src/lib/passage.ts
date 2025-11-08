import { Editor } from '@tiptap/react';
import { Node } from '@tiptap/pm/model';
import {
  annotationExportsFromNode,
  markAnnotationFromNode,
  parameterAnnotationFromNode,
} from './exporters';
import { findNodePosition, nodeNotFound } from './exporters/util';
import { ExporterContext } from './exporters/export';
import { Passage } from '@data-access';

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
