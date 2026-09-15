import type { AnnotationDTO } from './annotation-type';
import {
  type AnnotationExporter,
  type AnnotationImporter,
  type AnnotationTransformer,
  type TrailerAnnotation,
  baseAnnotationFromDTO,
  baseAnnotationFromImport,
  baseAnnotationToDto,
} from './annotation';

export const transformer: AnnotationTransformer = (dto): TrailerAnnotation => {
  return baseAnnotationFromDTO(dto) as TrailerAnnotation;
};

export const exporter: AnnotationExporter = (annotation): AnnotationDTO => {
  return baseAnnotationToDto(annotation);
};

export const importer: AnnotationImporter = (input): TrailerAnnotation =>
  baseAnnotationFromImport(input, 'trailer') as TrailerAnnotation;
