import type { AnnotationDTO } from './annotation-type';
import {
  type AnnotationExporter,
  type AnnotationTransformer,
  type QuoteAnnotation,
  baseAnnotationFromDTO,
  baseAnnotationToDto,
} from './annotation';

export const transformer: AnnotationTransformer = (dto): QuoteAnnotation => {
  const quoteAnnotation = baseAnnotationFromDTO(dto) as QuoteAnnotation;
  dto.content.forEach((content) => {
    if (content.uuid) {
      quoteAnnotation.quote = content.uuid as string;
    }
  });

  return quoteAnnotation;
};

export const exporter: AnnotationExporter = (annotation): AnnotationDTO => {
  const { quote } = annotation as QuoteAnnotation;
  const dto = baseAnnotationToDto(annotation);
  if (quote) {
    dto.content.push({
      uuid: quote,
    });
  }
  return dto;
};
