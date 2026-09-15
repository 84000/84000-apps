import type { AnnotationDTO } from './annotation-type';
import {
  type AnnotationExporter,
  type AnnotationTransformer,
  type UnknownAnnotation,
  baseAnnotationFromDTO,
  baseAnnotationToDto,
} from './annotation';

/**
 * Catch-all for a stored type with no domain model, which in practice means the
 * legacy `deprecated-*` rows. The stored type and content are kept verbatim so
 * the exporter can put the row back as it was: without them a save rewrites
 * every such row to a bare `unknown`, losing what it was and what it carried.
 */
export const transformer: AnnotationTransformer = (dto): UnknownAnnotation => {
  const annotation = baseAnnotationFromDTO(dto) as UnknownAnnotation;
  annotation.dtoType = dto.type;
  annotation.dtoContent = dto.content;
  return annotation;
};

export const exporter: AnnotationExporter = (annotation): AnnotationDTO => {
  const { dtoType, dtoContent } = annotation as UnknownAnnotation;
  const dto = baseAnnotationToDto(annotation);

  if (dtoType) {
    dto.type = dtoType as AnnotationDTO['type'];
  }
  if (dtoContent) {
    dto.content = dtoContent;
  }

  return dto;
};
