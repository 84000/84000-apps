import type { AnnotationDTO } from './annotation-type';
import {
  type AnnotationExporter,
  type AnnotationTransformer,
  type TableBodyHeaderAnnotation,
  baseAnnotationFromDTO,
  baseAnnotationToDto,
} from './annotation';

export const transformer: AnnotationTransformer = (
  dto,
): TableBodyHeaderAnnotation => {
  return baseAnnotationFromDTO(dto) as TableBodyHeaderAnnotation;
};

export const exporter: AnnotationExporter = (annotation): AnnotationDTO => {
  return baseAnnotationToDto(annotation);
};
