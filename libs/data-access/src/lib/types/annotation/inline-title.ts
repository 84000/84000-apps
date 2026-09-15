import type { AnnotationDTO } from './annotation-type';
import {
  type AnnotationExporter,
  type AnnotationImporter,
  type AnnotationTransformer,
  type InlineTitleAnnotation,
  baseAnnotationFromDTO,
  baseAnnotationFromImport,
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

export const importer: AnnotationImporter = (
  input,
): InlineTitleAnnotation | null => {
  const lang = input.data?.lang;
  if (typeof lang !== 'string' || !lang) {
    // The language is what an inline title carries; without it there is
    // nothing to distinguish it from unmarked text.
    return null;
  }
  const title = baseAnnotationFromImport(
    input,
    'inlineTitle',
  ) as InlineTitleAnnotation;
  title.lang = lang as InlineTitleAnnotation['lang'];
  return title;
};
