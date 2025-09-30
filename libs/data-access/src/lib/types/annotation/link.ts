import type { AnnotationDTO } from './annotation-type';
import {
  type AnnotationExporter,
  type AnnotationTransformer,
  type LinkAnnotation,
  baseAnnotationFromDTO,
  baseAnnotationToDto,
} from './annotation';

export const transformer: AnnotationTransformer = (dto): LinkAnnotation => {
  const linkAnnotation = baseAnnotationFromDTO(dto) as LinkAnnotation;
  dto.content.forEach((content) => {
    if (content.title) {
      linkAnnotation.text = content.title as string;
    }

    if (content.href) {
      linkAnnotation.href = content.href as string;
    }
  });

  return linkAnnotation;
};

export const exporter: AnnotationExporter = (annotation): AnnotationDTO => {
  const { href, text } = annotation as LinkAnnotation;
  const dto = baseAnnotationToDto(annotation);
  dto.content.push({
    href,
  });

  if (text) {
    dto.content.push({
      title: text,
    });
  }
  return dto;
};
