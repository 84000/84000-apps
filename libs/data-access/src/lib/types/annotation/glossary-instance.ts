import type { AnnotationDTO } from './annotation-type';
import {
  type AnnotationExporter,
  type AnnotationTransformer,
  type GlossaryInstanceAnnotation,
  baseAnnotationFromDTO,
  baseAnnotationToDto,
} from './annotation';

export const transformer: AnnotationTransformer = (
  dto,
): GlossaryInstanceAnnotation => {
  const baseAnnotation = baseAnnotationFromDTO(dto);
  const glossaryInstance = baseAnnotation as GlossaryInstanceAnnotation;
  dto.content.forEach((content) => {
    if (content.uuid) {
      glossaryInstance.glossary = content.uuid as string;
    }
  });
  return glossaryInstance;
};

export const exporter: AnnotationExporter = (annotation): AnnotationDTO => {
  const { glossary: uuid } = annotation as GlossaryInstanceAnnotation;
  const dto = baseAnnotationToDto(annotation);
  dto.content.push({
    uuid,
  });
  return dto;
};
