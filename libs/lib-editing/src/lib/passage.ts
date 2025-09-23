import { Node } from '@tiptap/pm/model';
import {
  AnnotationExportDTO,
  annotationsFromNode,
  markAnnotationFromNode,
  parameterAnnotationFromNode,
} from './exporters';
import { findNodePosition, nodeNotFound } from './exporters/util';
import { ExporterContext } from './exporters/export';

export type PassageExportDTO = {
  uuid: string;
  sort: number;
  type: string;
  label?: string;
  content: string;
  annotations: AnnotationExportDTO[];
};

export const passageFromNode = (node: Node): PassageExportDTO => {
  const uuid = node.attrs.uuid;
  const type = node.attrs.type;

  const ctx: ExporterContext = { node, parent: node, root: node, start: 0 };
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
      ...annotationsFromNode({ node: child, parent: node, root: node, start }),
    );
  });

  const passage: PassageExportDTO = {
    uuid,
    type,
    sort: node.attrs.sort,
    label: node.attrs.label,
    content: node.textContent,
    annotations,
  };
  return passage;
};
