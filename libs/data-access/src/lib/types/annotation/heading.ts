import type { AnnotationDTO } from './annotation-type';
import {
  type AnnotationExporter,
  type AnnotationImporter,
  type AnnotationTransformer,
  type HeadingAnnotation,
  HeadingClass,
  baseAnnotationFromDTO,
  baseAnnotationFromImport,
  baseAnnotationToDto,
  normalizeAlign,
} from './annotation';

const HEADING_CLASS_FALLBACK: HeadingClass = 'section-title';

export const transformer: AnnotationTransformer = (dto): HeadingAnnotation => {
  const heading = baseAnnotationFromDTO(dto) as HeadingAnnotation;
  dto.content.forEach((content) => {
    if (content['heading-level']) {
      const headerStr = content['heading-level'] as string;
      const levelStr = headerStr.replace('h', '');
      const level = parseInt(levelStr, 10);
      heading.level = level;
    }

    if (content['heading-type']) {
      heading.class = content['heading-type'] as HeadingClass;
    }

    const align = normalizeAlign(content['align']);
    if (align) {
      heading.align = align;
    }
  });

  return heading;
};

export const exporter: AnnotationExporter = (annotation): AnnotationDTO => {
  const { level, class: headingClass } = annotation as HeadingAnnotation;
  const dto = baseAnnotationToDto(annotation);
  dto.content.push({
    'heading-level': `h${level}`,
    ...(headingClass ? { 'heading-type': headingClass } : {}),
  });

  const align = normalizeAlign((annotation as HeadingAnnotation).align);
  if (align) {
    dto.content.push({ align });
  }
  return dto;
};

export const importer: AnnotationImporter = (input): HeadingAnnotation => {
  const heading = baseAnnotationFromImport(input, 'heading') as HeadingAnnotation;
  heading.level = typeof input.data?.level === 'number' ? input.data.level : 1;
  heading.class =
    typeof input.data?.class === 'string'
      ? (input.data.class as HeadingClass)
      : HEADING_CLASS_FALLBACK;
  return heading;
};
