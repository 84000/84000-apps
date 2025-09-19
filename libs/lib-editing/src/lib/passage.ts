import { Node } from '@tiptap/pm/model';
import {
  AnnotationExportDTO,
  annotationsFromNode,
  markAnnotationFromNode,
  parameterAnnotationFromNode,
} from './exporters';

export type PassageExportDTO = {
  uuid: string;
  sort: number;
  type: string;
  label?: string;
  content: string;
  annotations: AnnotationExportDTO[];
};

export const passageFromNode = (node: Node): PassageExportDTO => {
  console.log(node);

  const annotations = [
    ...parameterAnnotationFromNode(node, node),
    ...markAnnotationFromNode(node, node),
  ];
  node.content.forEach((child) => {
    annotations.push(...annotationsFromNode(child, node));
  });

  const passage: PassageExportDTO = {
    uuid: node.attrs.uuid,
    sort: node.attrs.sort,
    type: node.attrs.type,
    label: node.attrs.label,
    content: node.textContent,
    annotations,
  };
  return passage;
};
