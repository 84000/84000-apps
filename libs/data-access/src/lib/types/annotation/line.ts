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
  return baseAnnotationFromDTO(dto) as LineAnnotation;
};

export const exporter: AnnotationExporter = (annotation): AnnotationDTO => {
  return baseAnnotationToDto(annotation);
};

export const importer: AnnotationImporter = (input): LineAnnotation => {
  return baseAnnotationFromImport(input, 'line') as LineAnnotation;
};
