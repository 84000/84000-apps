import type { AnnotationDTO } from './annotation-type';
import {
  type AnnotationExporter,
  type AnnotationTransformer,
  type CommentAnnotation,
  baseAnnotationFromDTO,
  baseAnnotationToDto,
} from './annotation';

export const transformer: AnnotationTransformer = (dto): CommentAnnotation => {
  const baseAnnotation = baseAnnotationFromDTO(dto);
  const comment = baseAnnotation as CommentAnnotation;
  dto.content.forEach((content) => {
    if (content.uuid) {
      comment.comment = content.uuid as string;
    }
  });
  return comment;
};

export const exporter: AnnotationExporter = (annotation): AnnotationDTO => {
  const { comment: uuid } = annotation as CommentAnnotation;
  const dto = baseAnnotationToDto(annotation);
  dto.content.push({ uuid });
  return dto;
};
