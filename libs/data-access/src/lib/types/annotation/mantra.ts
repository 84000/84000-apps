import type { AnnotationDTO } from './annotation-type';
import {
  type AnnotationExporter,
  type AnnotationTransformer,
  type MantraAnnotation,
  baseAnnotationFromDTO,
  baseAnnotationToDto,
} from './annotation';
import type { ExtendedTranslationLanguage } from '../language';

export const transformer: AnnotationTransformer = (dto): MantraAnnotation => {
  const mantraAnnotation = baseAnnotationFromDTO(dto) as MantraAnnotation;
  dto.content.forEach((content) => {
    if (content.lang) {
      mantraAnnotation.lang = content.lang as ExtendedTranslationLanguage;
    }
  });
  return mantraAnnotation;
};

export const exporter: AnnotationExporter = (annotation): AnnotationDTO => {
  const { lang } = annotation as MantraAnnotation;
  const dto = baseAnnotationToDto(annotation);

  if (lang) {
    dto.content.push({
      lang,
    });
  }
  return dto;
};
