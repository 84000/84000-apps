import type { AnnotationDTO } from './annotation-type';
import {
  type AnnotationExporter,
  type AnnotationImporter,
  type AnnotationTransformer,
  type LeadingSpaceAnnotation,
  baseAnnotationFromDTO,
  baseAnnotationFromImport,
  baseAnnotationToDto,
} from './annotation';

export const transformer: AnnotationTransformer = (
  dto,
): LeadingSpaceAnnotation => {
  return baseAnnotationFromDTO(dto) as LeadingSpaceAnnotation;
};

export const exporter: AnnotationExporter = (annotation): AnnotationDTO => {
  return baseAnnotationToDto(annotation);
};

export const importer: AnnotationImporter = (
  input,
): LeadingSpaceAnnotation =>
  baseAnnotationFromImport(input, 'leadingSpace') as LeadingSpaceAnnotation;
