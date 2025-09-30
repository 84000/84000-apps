import type { AnnotationDTO } from './annotation-type';
import {
  type AnnotationExporter,
  type AnnotationTransformer,
  type ListAnnotation,
  baseAnnotationFromDTO,
  baseAnnotationToDto,
} from './annotation';

export const transformer: AnnotationTransformer = (dto): ListAnnotation => {
  const listAnnotation = baseAnnotationFromDTO(dto) as ListAnnotation;
  dto.content.forEach((content) => {
    if (content['list-spacing']) {
      listAnnotation.spacing = content['list-spacing'] as string;
    }

    if (content['list-item-style']) {
      listAnnotation.itemStyle = content['list-item-style'] as string;
    }

    if (content.nesting) {
      listAnnotation.nesting = Number.parseInt(content.nesting as string);
    }
  });

  return listAnnotation;
};

export const exporter: AnnotationExporter = (annotation): AnnotationDTO => {
  const { spacing, nesting, itemStyle } = annotation as ListAnnotation;
  const dto = baseAnnotationToDto(annotation);
  if (spacing) {
    dto.content.push({ 'list-spacing': spacing });
  }
  if (nesting) {
    dto.content.push({ nesting });
  }
  if (itemStyle) {
    dto.content.push({ 'list-item-style': itemStyle });
  }

  return dto;
};
