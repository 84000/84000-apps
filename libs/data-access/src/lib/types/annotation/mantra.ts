import type { AnnotationDTO } from './annotation-type';
import {
  type AnnotationExporter,
  type AnnotationImporter,
  type AnnotationTransformer,
  type MantraAnnotation,
  baseAnnotationFromDTO,
  baseAnnotationFromImport,
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

export const importer: AnnotationImporter = (input): MantraAnnotation => {
  const mantra = baseAnnotationFromImport(input, 'mantra') as MantraAnnotation;
  const lang = input.data?.lang;
  if (typeof lang === 'string' && lang) {
    mantra.lang = lang as ExtendedTranslationLanguage;
  }
  return mantra;
};
