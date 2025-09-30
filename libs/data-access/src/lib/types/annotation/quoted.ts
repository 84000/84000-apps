import type { AnnotationDTO } from './annotation-type';
import {
  type AnnotationExporter,
  type AnnotationTransformer,
  type QuotedAnnotation,
  baseAnnotationFromDTO,
  baseAnnotationToDto,
} from './annotation';

export const transformer: AnnotationTransformer = (dto): QuotedAnnotation => {
  const quotedAnnotation = baseAnnotationFromDTO(dto) as QuotedAnnotation;
  dto.content.forEach((content) => {
    if (content.uuid) {
      quotedAnnotation.quote = content.uuid as string;
    }
  });

  return quotedAnnotation;
};

export const exporter: AnnotationExporter = (annotation): AnnotationDTO => {
  const { quote } = annotation as QuotedAnnotation;
  const dto = baseAnnotationToDto(annotation);
  if (quote) {
    dto.content.push({
      uuid: quote,
    });
  }
  return dto;
};
