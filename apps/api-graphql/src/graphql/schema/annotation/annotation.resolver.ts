import {
  annotationFromDTO,
  type AnnotationDTO,
  type HeadingAnnotation,
  type InternalLinkAnnotation,
  type LinkAnnotation,
  type SpanAnnotation,
  type MantraAnnotation,
  type InlineTitleAnnotation,
  type AudioAnnotation,
  type ImageAnnotation,
  type ListAnnotation,
  type GlossaryInstanceAnnotation,
  type EndNoteLinkAnnotation,
  type AbbreviationAnnotation,
  type HasAbbreviationAnnotation,
  type QuoteAnnotation,
  type QuotedAnnotation,
} from '@data-access';

/**
 * Transformed annotation for GraphQL response
 */
interface TransformedAnnotation {
  uuid: string;
  type: string;
  start: number;
  end: number;
  metadata: Record<string, unknown> | null;
}

/**
 * Extracts type-specific metadata from the parsed domain annotation.
 * Returns null if there's no type-specific data.
 */
function extractMetadata(
  annotation: ReturnType<typeof annotationFromDTO>,
): Record<string, unknown> | null {
  switch (annotation.type) {
    case 'heading': {
      const { level, class: headingClass } = annotation as HeadingAnnotation;
      return { level, ...(headingClass && { class: headingClass }) };
    }

    case 'internalLink': {
      const { linkType, href, label, entity, isPending } =
        annotation as InternalLinkAnnotation;
      const meta: Record<string, unknown> = {};
      if (linkType) meta.linkType = linkType;
      if (href) meta.href = href;
      if (label) meta.label = label;
      if (entity) meta.entity = entity;
      if (isPending) meta.isPending = isPending;
      return Object.keys(meta).length > 0 ? meta : null;
    }

    case 'link': {
      const { href, text } = annotation as LinkAnnotation;
      return { href, text };
    }

    case 'span': {
      const { textStyle, lang } = annotation as SpanAnnotation;
      const meta: Record<string, unknown> = {};
      if (textStyle) meta.textStyle = textStyle;
      if (lang) meta.lang = lang;
      return Object.keys(meta).length > 0 ? meta : null;
    }

    case 'mantra': {
      const { lang } = annotation as MantraAnnotation;
      return { lang };
    }

    case 'inlineTitle': {
      const { lang } = annotation as InlineTitleAnnotation;
      return { lang };
    }

    case 'audio': {
      const { src, mediaType } = annotation as AudioAnnotation;
      return { src, mediaType };
    }

    case 'image': {
      const { src } = annotation as ImageAnnotation;
      return { src };
    }

    case 'list': {
      const { spacing, nesting, itemStyle } = annotation as ListAnnotation;
      const meta: Record<string, unknown> = {};
      if (spacing) meta.spacing = spacing;
      if (nesting !== undefined) meta.nesting = nesting;
      if (itemStyle) meta.itemStyle = itemStyle;
      return Object.keys(meta).length > 0 ? meta : null;
    }

    case 'glossaryInstance': {
      const { glossary } = annotation as GlossaryInstanceAnnotation;
      return { glossary };
    }

    case 'endNoteLink': {
      const { endNote, label } = annotation as EndNoteLinkAnnotation;
      const meta: Record<string, unknown> = { endNote };
      if (label) meta.label = label;
      return meta;
    }

    case 'abbreviation': {
      const { abbreviation } = annotation as AbbreviationAnnotation;
      return { abbreviation };
    }

    case 'hasAbbreviation': {
      const { abbreviation } = annotation as HasAbbreviationAnnotation;
      return { abbreviation };
    }

    case 'quote': {
      const { quote } = annotation as QuoteAnnotation;
      return quote ? { quote } : null;
    }

    case 'quoted': {
      const { quote } = annotation as QuotedAnnotation;
      return quote ? { quote } : null;
    }

    default:
      return null;
  }
}

/**
 * Maps the parsed domain annotation to a GraphQL-compatible format.
 * Uses data-access's annotationFromDTO for parsing, then extracts
 * type-specific fields into a metadata object.
 */
export function transformAnnotation(
  dto: AnnotationDTO,
  passageLength: number = Number.MAX_SAFE_INTEGER,
): TransformedAnnotation {
  // Use data-access's parsing logic to get the domain model
  const annotation = annotationFromDTO(dto, passageLength);

  return {
    uuid: annotation.uuid,
    type: annotation.type,
    start: annotation.start,
    end: annotation.end,
    metadata: extractMetadata(annotation),
  };
}
