import type { AnnotationDTO } from './annotation-type';
import {
  type AnnotationExporter,
  type AnnotationImporter,
  type AnnotationTransformer,
  type LineAnnotation,
  baseAnnotationFromDTO,
  baseAnnotationFromImport,
  baseAnnotationToDto,
} from './annotation';

export const transformer: AnnotationTransformer = (dto): LineAnnotation => {
  const line = baseAnnotationFromDTO(dto) as LineAnnotation;
  dto.content.forEach((content) => {
    if (content.lang) {
      line.lang = content.lang as LineAnnotation['lang'];
    }
  });
  return line;
};

export const exporter: AnnotationExporter = (annotation): AnnotationDTO => {
  const { lang } = annotation as LineAnnotation;
  const dto = baseAnnotationToDto(annotation);
  if (lang) {
    dto.content.push({ lang });
  }
  return dto;
};

export const importer: AnnotationImporter = (input): LineAnnotation => {
  return baseAnnotationFromImport(input, 'line') as LineAnnotation;
};
