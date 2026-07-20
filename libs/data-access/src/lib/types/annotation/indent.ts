import type { AnnotationDTO } from './annotation-type';
import {
  type AnnotationExporter,
  type AnnotationImporter,
  type AnnotationTransformer,
  type IndentAnnotation,
  baseAnnotationFromDTO,
  baseAnnotationFromImport,
  baseAnnotationToDto,
} from './annotation';

export const transformer: AnnotationTransformer = (dto): IndentAnnotation => {
  return baseAnnotationFromDTO(dto) as IndentAnnotation;
};

export const exporter: AnnotationExporter = (annotation): AnnotationDTO => {
  return baseAnnotationToDto(annotation);
};

export const importer: AnnotationImporter = (input): IndentAnnotation => {
  return baseAnnotationFromImport(input, 'indent') as IndentAnnotation;
};
