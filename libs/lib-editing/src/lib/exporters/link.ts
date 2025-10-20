import {
  AnnotationType,
  InternalLinkAnnotation,
  LinkAnnotation,
  ReferenceAnnotation,
} from '@data-access';
import { Exporter, ExporterContext } from './export';

export const LINK_TYPES: AnnotationType[] = ['link', 'reference'];

export const link: Exporter<
  LinkAnnotation | InternalLinkAnnotation | ReferenceAnnotation
> = ({
  mark,
  node,
  parent,
  start,
  passageUuid,
}: ExporterContext):
  | InternalLinkAnnotation
  | LinkAnnotation
  | ReferenceAnnotation
  | undefined => {
  const type = mark?.attrs.type || mark?.type.name;
  const uuid = mark?.attrs.uuid;

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

  const baseAnnotation = {
    uuid,
    type,
    passageUuid,
    start,
    end: start + textContent.length,
    href,
  };

  switch (type) {
    case 'reference':
      // TODO: implement optional fields
      // const passage = mark?.attrs.passage;
      // const authority = mark?.attrs.authority;
      // const work = mark?.attrs.work;
      return {
        ...baseAnnotation,
        type: 'reference',
      } as ReferenceAnnotation;
    case 'link': {
      const text = mark?.attrs.text;
      return {
        ...baseAnnotation,
        type: 'link',
        text,
      } as LinkAnnotation;
    }
  }
};
