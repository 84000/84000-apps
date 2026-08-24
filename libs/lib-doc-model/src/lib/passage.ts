import { Node } from '@tiptap/pm/model';
import { Passage } from '@eightyfourthousand/data-access';
import {
  annotationExportsFromNode,
  markAnnotationFromNode,
  parameterAnnotationFromNode,
} from './exporters';
import { findNodePosition, nodeNotFound } from './exporters/util';
import { ExporterContext } from './exporters/export';

/**
 * Materialize a `passages` row (content plus annotations) from one passage's
 * ProseMirror node.
 *
 * This is the row-materialization half of the doc model: a passage doc is
 * converted to a ProseMirror node, then to a row, by the same exporters the
 * single-document editor used. It is deliberately free of any editor or
 * browser dependency so the server-side write path can call it too.
 *
 * `node` is the passage's *content* node — its children are the passage's
 * blocks. Identity (uuid, label, sort, type, toh) is passed in rather than
 * read off the node, because in the per-passage model that metadata lives in
 * the spine, not inside the document.
 */
export const passageFromNode = (
  node: Node,
  workUuid: string,
  identity: {
    uuid: string;
    type: Passage['type'];
    sort: number;
    label: string;
    toh?: Passage['toh'];
    /**
     * Set when the passage was flagged invalid on load: it carries
     * annotations that were never rendered, so its exported set is incomplete
     * by construction.
     */
    invalid?: boolean;
  },
): Passage => {
  const { uuid, type, sort, label, toh, invalid } = identity;

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

  const annotationsIncomplete = skipped.count > 0 || !!invalid;
  if (annotationsIncomplete) {
    console.error(
      `Annotation export for passage ${uuid} is incomplete ` +
        `(${skipped.count} skipped${invalid ? ', passage flagged invalid' : ''}); ` +
        'its existing annotations will be preserved on save.',
    );
  }

  return {
    uuid,
    type,
    workUuid,
    sort,
    label,
    content: node.textContent,
    toh,
    annotations,
    ...(annotationsIncomplete ? { annotationsIncomplete } : {}),
  };
};
