import { Node } from '@tiptap/pm/model';

export type AnnotationExportDTO = {
  uuid: string;
  type: string;
  content: string;
};

export type PassageExportDTO = {
  uuid: string;
  sort: number;
  type: string;
  label?: string;
  content: string;
  annotations: AnnotationExportDTO[];
};

export const parameterAnnotationFromNode = (
  node: Node,
  parent: Node,
): AnnotationExportDTO[] => {
  const annotations: AnnotationExportDTO[] = [];
  const content = node.textContent || parent.textContent || '';
  // TODO: fix uuids
  if (node.attrs.hasIndent) {
    annotations.push({
      uuid: `${node.attrs.uuid}-indent`,
      type: 'indent',
      content,
    });
  }

  if (node.attrs.hasLeadingSpace) {
    annotations.push({
      uuid: `${node.attrs.uuid}-leading-space`,
      type: 'leading-space',
      content,
    });
  }

  if (node.attrs.hasTrailer) {
    annotations.push({
      uuid: `${node.attrs.uuid}-trailer`,
      type: 'trailer',
      content,
    });
  }

  return annotations;
};

export const markAnnotationFromNode = (
  node: Node,
  parent: Node,
): AnnotationExportDTO[] => {
  const annotations: AnnotationExportDTO[] = [];
  node.marks.forEach((mark) => {
    if (mark.attrs.uuid) {
      annotations.push({
        uuid: mark.attrs.uuid,
        type: mark.type.name,
        content: node.textContent || parent.textContent || '',
      });
    }
  });
  return annotations;
};

export const annotationsFromNode = (
  node: Node,
  parent: Node,
): AnnotationExportDTO[] => {
  const annotations = [
    ...parameterAnnotationFromNode(node, parent),
    ...markAnnotationFromNode(node, parent),
  ];

  // TOOD: create exporters for each annotation type
  if (node.type.name !== 'text' && node.attrs.uuid) {
    annotations.push({
      uuid: node.attrs.uuid,
      type: node.type.name,
      content: node.textContent || parent.textContent || '',
    });
  }

  node.content.forEach((child) => {
    annotations.push(...annotationsFromNode(child, node));
  });
  return annotations;
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
