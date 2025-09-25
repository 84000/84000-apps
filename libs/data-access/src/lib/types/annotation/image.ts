import type { AnnotationDTO } from './annotation-type';
import {
  type AnnotationExporter,
  type AnnotationTransformer,
  type ImageAnnotation,
  baseAnnotationFromDTO,
  baseAnnotationToDto,
} from './annotation';

export const transformer: AnnotationTransformer = (dto): ImageAnnotation => {
  const baseAnnotation = baseAnnotationFromDTO(dto);
  const image = baseAnnotation as ImageAnnotation;
  dto.content.forEach((content) => {
    if (content.src) {
      image.src = content.src as string;
    }
  });

  return image;
};

export const exporter: AnnotationExporter = (annotation): AnnotationDTO => {
  const { src } = annotation as ImageAnnotation;
  const dto = baseAnnotationToDto(annotation);
  dto.content.push({
    src,
  });
  return dto;
};
