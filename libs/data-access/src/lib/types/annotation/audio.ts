import {
  type AnnotationExporter,
  type AnnotationTransformer,
  type AudioAnnotation,
  baseAnnotationFromDTO,
  baseAnnotationToDto,
} from './annotation';
import { AnnotationDTO, AnnotationDTOContent } from './annotation-type';

export const transformer: AnnotationTransformer = (dto): AudioAnnotation => {
  const baseAnnotation = baseAnnotationFromDTO(dto);
  const audio = baseAnnotation as AudioAnnotation;
  dto.content.forEach((content) => {
    if (content.src) {
      audio.src = content.src as string;
    }
    if (content['media-type']) {
      audio.mediaType = content['media-type'] as string;
    }
  });

  return audio;
};

export const exporter: AnnotationExporter = (annotation): AnnotationDTO => {
  const { src, mediaType } = annotation as AudioAnnotation;
  const dto = baseAnnotationToDto(annotation);
  dto.content.push({
    src,
    'media-type': mediaType,
  } as AnnotationDTOContent);
  return dto;
};
