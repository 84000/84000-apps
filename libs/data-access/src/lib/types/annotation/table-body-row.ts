import type { AnnotationDTO } from './annotation-type';
import {
  type AnnotationExporter,
  type AnnotationTransformer,
  type TableBodyRowAnnotation,
  baseAnnotationFromDTO,
  baseAnnotationToDto,
} from './annotation';

export const transformer: AnnotationTransformer = (
  dto,
): TableBodyRowAnnotation => {
  return baseAnnotationFromDTO(dto) as TableBodyRowAnnotation;
};

export const exporter: AnnotationExporter = (annotation): AnnotationDTO => {
  return baseAnnotationToDto(annotation);
};
