import type { AnnotationDTO } from './annotation-type';
import {
  type AnnotationExporter,
  type AnnotationTransformer,
  type InlineTitleAnnotation,
  baseAnnotationFromDTO,
  baseAnnotationToDto,
} from './annotation';
import { TranslationLanguage } from '../language';

export const transformer: AnnotationTransformer = (
  dto,
): InlineTitleAnnotation => {
  const inlineTitle = baseAnnotationFromDTO(dto) as InlineTitleAnnotation;
  dto.content.forEach((content) => {
    if (content.lang) {
      inlineTitle.lang = content.lang as TranslationLanguage;
    }
  });

  return inlineTitle;
};

export const exporter: AnnotationExporter = (annotation): AnnotationDTO => {
  const { lang } = annotation as InlineTitleAnnotation;
  const dto = baseAnnotationToDto(annotation);

  if (lang) {
    dto.content.push({
      lang,
    });
  }
  return dto;
};
