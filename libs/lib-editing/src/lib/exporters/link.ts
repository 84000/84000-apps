import { AnnotationType } from '@data-access';
import { Exporter, ExporterContext } from './export';
import { AnnotationExportDTO } from './annotation';

export const LINK_TYPES: AnnotationType[] = [
  'internalLink',
  'link',
  'reference',
];

export const link: Exporter<AnnotationExportDTO> = ({
  mark,
  node,
  parent,
}: ExporterContext) => {
  const type = mark?.attrs.type;
  const uuid = mark?.attrs.uuid;

  // optional fields
  const passage = mark?.attrs.passage;
  const authority = mark?.attrs.authority;
  const work = mark?.attrs.work;

  if (!type || !LINK_TYPES.includes(type)) {
    console.warn(`Link mark ${uuid} has invalid or missing type: ${type}`);
    return undefined;
  }

  const href = mark?.attrs.href;
  const textContent = node.textContent || parent.textContent || '';
  if (!href || !textContent) {
    console.warn(`Link mark ${uuid} is incomplete`);
    return undefined;
  }

  return {
    uuid,
    type,
    textContent,
    attrs: {
      href,
      passage,
      authority,
      work,
    },
  };
};
