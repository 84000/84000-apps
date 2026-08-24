import { Node } from '@tiptap/pm/model';
import {
  annotationExportsFromNode,
  markAnnotationFromNode,
  parameterAnnotationFromNode,
} from './exporters';
import { findNodePosition, nodeNotFound } from './exporters/util';
import { ExporterContext } from './exporters/export';
import { Passage } from '@eightyfourthousand/data-access';

export const passageFromNode = (node: Node, workUuid: string): Passage => {
  const uuid = node.attrs.uuid;
  const type = node.attrs.type;
  const toh = node.attrs.toh;

  const skipped = { count: 0 };
  const ctx: ExporterContext = {
    passageUuid: uuid,
    node,
    parent: node,
    root: node,
    start: 0,
    skipped,
  };
  const annotations = [
    ...parameterAnnotationFromNode(ctx),
    ...markAnnotationFromNode(ctx),
  ];
  node.content.forEach((child) => {
    const start = findNodePosition(node, child.attrs.uuid, child.type.name);
    if (start === undefined) {
      return nodeNotFound(child, skipped);
    }
    annotations.push(
      ...annotationExportsFromNode({
        passageUuid: uuid,
        node: child,
        parent: node,
        root: node,
        start,
        skipped,
      }),
    );
  });

  // A passage flagged invalid on load carries annotations that were never
  // rendered (out of range or unplaceable), so its exported set is incomplete
  // by construction.
  const annotationsIncomplete = skipped.count > 0 || !!node.attrs.invalid;
  if (annotationsIncomplete) {
    console.error(
      `Annotation export for passage ${uuid} is incomplete ` +
        `(${skipped.count} skipped${node.attrs.invalid ? ', passage flagged invalid' : ''}); ` +
        'its existing annotations will be preserved on save.',
    );
  }

  const passage: Passage = {
    uuid,
    type,
    workUuid,
    sort: node.attrs.sort,
    label: node.attrs.label,
    content: node.textContent,
    toh,
    annotations,
    ...(annotationsIncomplete ? { annotationsIncomplete } : {}),
  };
  return passage;
};
