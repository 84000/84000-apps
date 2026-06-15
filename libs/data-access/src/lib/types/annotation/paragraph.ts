import type { AnnotationDTO } from './annotation-type';
import {
  type AnnotationExporter,
  type AnnotationTransformer,
  type ParagraphAnnotation,
  baseAnnotationFromDTO,
  baseAnnotationToDto,
  normalizeAlign,
  normalizeWhitespace,
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

    const whitespace = normalizeWhitespace(content['whitespace']);
    if (whitespace) {
      paragraph.whitespace = whitespace;
    }
  });
  return paragraph;
};

export const exporter: AnnotationExporter = (annotation): AnnotationDTO => {
  const dto = baseAnnotationToDto(annotation);
  const { align, whitespace } = annotation as ParagraphAnnotation;

  const normalizedAlign = normalizeAlign(align);
  if (normalizedAlign) {
    dto.content.push({ align: normalizedAlign });
  }

  const normalizedWhitespace = normalizeWhitespace(whitespace);
  if (normalizedWhitespace) {
    dto.content.push({ whitespace: normalizedWhitespace });
  }
  return dto;
};
