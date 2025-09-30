import type { AnnotationDTO } from './annotation-type';
import {
  type AnnotationExporter,
  type AnnotationTransformer,
  type DeprecatedAnnotation,
  baseAnnotationFromDTO,
  baseAnnotationToDto,
} from './annotation';

export const transformer: AnnotationTransformer = (
  dto,
): DeprecatedAnnotation => {
  return baseAnnotationFromDTO(dto) as DeprecatedAnnotation;
};

export const exporter: AnnotationExporter = (annotation): AnnotationDTO => {
  return baseAnnotationToDto(annotation);
};
