import type { AnnotationDTO } from './annotation-type';
import {
  type AnnotationExporter,
  type AnnotationTransformer,
  type HasAbbreviationAnnotation,
  baseAnnotationFromDTO,
  baseAnnotationToDto,
} from './annotation';

export const transformer: AnnotationTransformer = (
  dto,
): HasAbbreviationAnnotation => {
  const baseAnnotation = baseAnnotationFromDTO(dto);
  const hasAbbreviation = baseAnnotation as HasAbbreviationAnnotation;
  dto.content.forEach((content) => {
    if (content.uuid) {
      hasAbbreviation.abbreviation = content.uuid as string;
    }
  });
  return hasAbbreviation;
};

export const exporter: AnnotationExporter = (annotation): AnnotationDTO => {
  const { abbreviation: uuid } = annotation as HasAbbreviationAnnotation;
  const dto = baseAnnotationToDto(annotation);
  dto.content.push({
    uuid,
  });
  return dto;
};
