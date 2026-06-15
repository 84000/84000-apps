import type { AnnotationDTO } from './annotation-type';
import {
  type AnnotationExporter,
  type AnnotationTransformer,
  type HeadingAnnotation,
  HeadingClass,
  baseAnnotationFromDTO,
  baseAnnotationToDto,
  normalizeAlign,
} from './annotation';

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
