import type { AnnotationDTO } from './annotation-type';
import {
  type AnnotationExporter,
  type AnnotationImporter,
  type AnnotationTransformer,
  type SpanAnnotation,
  baseAnnotationFromDTO,
  baseAnnotationFromImport,
  baseAnnotationToDto,
} from './annotation';
import type { ExtendedTranslationLanguage } from '../language';

export const transformer: AnnotationTransformer = (dto): SpanAnnotation => {
  const spanAnnotation = baseAnnotationFromDTO(dto) as SpanAnnotation;
  dto.content.forEach((content) => {
    if (content['text-style']) {
      spanAnnotation.textStyle = content['text-style'] as string;
    }

    if (content.lang) {
      spanAnnotation.lang = content.lang as ExtendedTranslationLanguage;
    }
  });
  return spanAnnotation;
};

export const exporter: AnnotationExporter = (annotation): AnnotationDTO => {
  const { textStyle, lang } = annotation as SpanAnnotation;
  const dto = baseAnnotationToDto(annotation);
  if (textStyle) {
    dto.content.push({
      'text-style': textStyle,
    });
  }
  if (lang) {
    dto.content.push({
      lang,
    });
  }
  return dto;
};

export const importer: AnnotationImporter = (input): SpanAnnotation => {
  const span = baseAnnotationFromImport(input, 'span') as SpanAnnotation;
  if (typeof input.data?.textStyle === 'string') {
    span.textStyle = input.data.textStyle;
  }
  if (typeof input.data?.lang === 'string') {
    span.lang = input.data.lang as ExtendedTranslationLanguage;
  }
  return span;
};
