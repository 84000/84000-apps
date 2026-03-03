import type { AnnotationDTO } from './annotation-type';
import {
  type AnnotationExporter,
  type AnnotationTransformer,
  type MentionAnnotation,
  baseAnnotationFromDTO,
  baseAnnotationToDto,
} from './annotation';

export const transformer: AnnotationTransformer = (
  dto,
): MentionAnnotation => {
  const mention = baseAnnotationFromDTO(dto) as MentionAnnotation;
  dto.content.forEach((content) => {
    if (content.uuid) {
      mention.entity = content.uuid as string;
    }
    if (content.type) {
      mention.linkType = content.type as string;
    }
    if (content.text) {
      mention.text = content.text as string;
    }
    if (content.same_work !== undefined) {
      mention.isSameWork = !!content.same_work;
    }
    if (content.subtype) {
      mention.subtype = content.subtype as string;
    }
    if (content.toh) {
      mention.linkToh = content.toh as string;
    }
  });

  return mention;
};

export const exporter: AnnotationExporter = (annotation): AnnotationDTO => {
  const { entity, linkType, text, isSameWork, subtype, linkToh } =
    annotation as MentionAnnotation;
  const dto = baseAnnotationToDto(annotation);

  if (entity) {
    dto.content.push({ uuid: entity });
  }
  if (linkType) {
    dto.content.push({ type: linkType });
  }
  // Persist custom override text, but NEVER persist displayText
  if (text) {
    dto.content.push({ text });
  }
  if (isSameWork !== undefined) {
    dto.content.push({ same_work: isSameWork });
  }
  if (subtype) {
    dto.content.push({ subtype });
  }
  if (linkToh) {
    dto.content.push({ toh: linkToh });
  }

  return dto;
};
