import type { AnnotationDTO } from './annotation-type';
import {
  type AnnotationExporter,
  type AnnotationTransformer,
  type EndNoteLinkAnnotation,
  baseAnnotationFromDTO,
  baseAnnotationToDto,
} from './annotation';

export const transformer: AnnotationTransformer = (
  dto,
): EndNoteLinkAnnotation => {
  const baseAnnotation = baseAnnotationFromDTO(dto);
  const endNote = baseAnnotation as EndNoteLinkAnnotation;
  dto.content.forEach((content) => {
    if (content.uuid) {
      endNote.endNote = content.uuid as string;
    }
  });

  return endNote;
};

export const exporter: AnnotationExporter = (annotation): AnnotationDTO => {
  const { endNote: uuid } = annotation as EndNoteLinkAnnotation;
  const dto = baseAnnotationToDto(annotation);
  dto.content.push({
    uuid,
  });
  return dto;
};
