import type { AnnotationDTO } from './annotation-type';
import {
  type AnnotationExporter,
  type AnnotationTransformer,
  type MentionAnnotation,
  baseAnnotationFromDTO,
  baseAnnotationToDto,
} from './annotation';

export const transformer: AnnotationTransformer = (dto): MentionAnnotation => {
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
    if (content.lang) {
      mention.lang = content.lang as MentionAnnotation['lang'];
    }
    if (content.style) {
      mention.style = content.style as MentionAnnotation['style'];
    }
    if (content.start !== undefined) {
      mention.highlightStart = Number(content.start);
    }
    if (content.end !== undefined) {
      mention.highlightEnd = Number(content.end);
    }
  });

  return mention;
};

export const exporter: AnnotationExporter = (annotation): AnnotationDTO => {
  const {
    entity,
    linkType,
    text,
    isSameWork,
    subtype,
    linkToh,
    lang,
    style,
    highlightStart,
    highlightEnd,
  } = annotation as MentionAnnotation;
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
  if (lang) {
    dto.content.push({ lang });
  }
  if (style) {
    dto.content.push({ style });
  }
  if (highlightStart !== undefined) {
    dto.content.push({ start: highlightStart });
  }
  if (highlightEnd !== undefined) {
    dto.content.push({ end: highlightEnd });
  }

  return dto;
};
