import type { AnnotationDTO } from './annotation-type';
import {
  type AnnotationExporter,
  type AnnotationTransformer,
  type TrailerAnnotation,
  baseAnnotationFromDTO,
  baseAnnotationToDto,
} from './annotation';

export const transformer: AnnotationTransformer = (dto): TrailerAnnotation => {
  return baseAnnotationFromDTO(dto) as TrailerAnnotation;
};

export const exporter: AnnotationExporter = (annotation): AnnotationDTO => {
  return baseAnnotationToDto(annotation);
};
