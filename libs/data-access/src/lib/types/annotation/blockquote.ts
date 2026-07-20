import type { AnnotationDTO } from './annotation-type';
import {
  type AnnotationExporter,
  type AnnotationImporter,
  type AnnotationTransformer,
  type BlockquoteAnnotation,
  baseAnnotationFromDTO,
  baseAnnotationFromImport,
  baseAnnotationToDto,
} from './annotation';

export const transformer: AnnotationTransformer = (
  dto,
): BlockquoteAnnotation => {
  return baseAnnotationFromDTO(dto) as BlockquoteAnnotation;
};

export const exporter: AnnotationExporter = (annotation): AnnotationDTO => {
  return baseAnnotationToDto(annotation);
};

export const importer: AnnotationImporter = (input): BlockquoteAnnotation => {
  return baseAnnotationFromImport(input, 'blockquote') as BlockquoteAnnotation;
};
