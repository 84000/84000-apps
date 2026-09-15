import type { AnnotationDTO } from './annotation-type';
import {
  type AnnotationExporter,
  type AnnotationImporter,
  type AnnotationTransformer,
  type MentionAnnotation,
  baseAnnotationFromDTO,
  baseAnnotationFromImport,
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

export const importer: AnnotationImporter = (
  input,
): MentionAnnotation | null => {
  const entity = input.data?.entity;
  const linkType = input.data?.linkType;
  if (typeof entity !== 'string' || !entity) {
    // A mention with no target cannot be represented; drop it.
    return null;
  }
  if (typeof linkType !== 'string' || !linkType) {
    // The link type decides how the reader resolves and renders the target.
    return null;
  }

  const mention = baseAnnotationFromImport(
    input,
    'mention',
  ) as MentionAnnotation;
  mention.entity = entity;
  mention.linkType = linkType;

  const { text, isSameWork, subtype, linkToh, lang, style } = input.data ?? {};
  if (typeof text === 'string') {
    mention.text = text;
  }
  if (typeof isSameWork === 'boolean') {
    mention.isSameWork = isSameWork;
  }
  if (typeof subtype === 'string') {
    mention.subtype = subtype;
  }
  // The target's Tohoku number, distinct from the row's own `toh` scope.
  if (typeof linkToh === 'string') {
    mention.linkToh = linkToh;
  }
  if (typeof lang === 'string') {
    mention.lang = lang as MentionAnnotation['lang'];
  }
  if (style === 'quote') {
    mention.style = style;
  }

  // A character range in the *target*, not in this passage — a commentary
  // quote pointing at the root text it comments on.
  const { highlightStart, highlightEnd } = input.data ?? {};
  if (typeof highlightStart === 'number') {
    mention.highlightStart = highlightStart;
  }
  if (typeof highlightEnd === 'number') {
    mention.highlightEnd = highlightEnd;
  }

  return mention;
};
