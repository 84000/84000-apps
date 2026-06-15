import type { AnnotationDTO } from './annotation-type';
import {
  type AnnotationExporter,
  type AnnotationTransformer,
  type ParagraphAnnotation,
  baseAnnotationFromDTO,
  baseAnnotationToDto,
  normalizeAlign,
} from './annotation';

export const transformer: AnnotationTransformer = (
  dto,
): ParagraphAnnotation => {
  const paragraph = baseAnnotationFromDTO(dto) as ParagraphAnnotation;
  dto.content.forEach((content) => {
    const align = normalizeAlign(content['align']);
    if (align) {
      paragraph.align = align;
    }
  });
  return paragraph;
};

export const exporter: AnnotationExporter = (annotation): AnnotationDTO => {
  const dto = baseAnnotationToDto(annotation);
  const align = normalizeAlign((annotation as ParagraphAnnotation).align);
  if (align) {
    dto.content.push({ align });
  }
  return dto;
};
