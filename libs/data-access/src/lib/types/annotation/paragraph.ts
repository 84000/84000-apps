import type { AnnotationDTO } from './annotation-type';
import {
  type AnnotationExporter,
  type AnnotationTransformer,
  type ParagraphAnnotation,
  baseAnnotationFromDTO,
  baseAnnotationToDto,
  normalizeAlign,
  normalizeWordBreak,
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

    const wordBreak = normalizeWordBreak(content['word-break']);
    if (wordBreak) {
      paragraph.wordBreak = wordBreak;
    }
  });
  return paragraph;
};

export const exporter: AnnotationExporter = (annotation): AnnotationDTO => {
  const dto = baseAnnotationToDto(annotation);
  const { align, wordBreak } = annotation as ParagraphAnnotation;

  const normalizedAlign = normalizeAlign(align);
  if (normalizedAlign) {
    dto.content.push({ align: normalizedAlign });
  }

  const normalizedWordBreak = normalizeWordBreak(wordBreak);
  if (normalizedWordBreak) {
    dto.content.push({ 'word-break': normalizedWordBreak });
  }
  return dto;
};
