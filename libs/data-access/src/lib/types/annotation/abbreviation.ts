import type { AnnotationDTO, AnnotationDTOContent } from './annotation-type';
import {
  type AbbreviationAnnotation,
  type AnnotationExporter,
  type AnnotationTransformer,
  baseAnnotationFromDTO,
  baseAnnotationToDto,
} from './annotation';

export const transformer: AnnotationTransformer = (
  dto,
): AbbreviationAnnotation => {
  const baseAnnotation = baseAnnotationFromDTO(dto);
  const abbreviation = baseAnnotation as AbbreviationAnnotation;
  dto.content.forEach((content) => {
    if (content.uuid) {
      abbreviation.abbreviation = content.uuid as string;
    }
  });
  return abbreviation;
};

export const exporter: AnnotationExporter = (annotation): AnnotationDTO => {
  const { abbreviation: uuid } = annotation as AbbreviationAnnotation;
  const dto = baseAnnotationToDto(annotation);
  dto.content.push({
    uuid,
  } as AnnotationDTOContent);
  return dto;
};
