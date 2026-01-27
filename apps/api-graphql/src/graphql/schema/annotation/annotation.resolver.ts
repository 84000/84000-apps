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
import type { AnnotationRow } from '../passage/passage.loader';

/**
 * Transformed annotation for GraphQL response
 */
interface TransformedAnnotation {
  uuid: string;
  type: string;
  start: number;
  end: number;
  // Type-specific fields
  level: number | null;
  headingClass: string | null;
  href: string | null;
  text: string | null;
  linkType: string | null;
  label: string | null;
  entity: string | null;
  isPending: boolean | null;
  textStyle: string | null;
  lang: string | null;
  glossary: string | null;
  endNote: string | null;
  src: string | null;
  mediaType: string | null;
  spacing: string | null;
  nesting: number | null;
  itemStyle: string | null;
  abbreviation: string | null;
  quote: string | null;
}

/**
 * Converts an AnnotationRow (from the DB loader) to an AnnotationDTO
 * that can be passed to data-access's annotationFromDTO.
 */
function rowToDTO(row: AnnotationRow): AnnotationDTO {
  return {
    uuid: row.uuid,
    passage_uuid: row.passage_uuid,
    type: row.type as AnnotationDTO['type'],
    start: row.start,
    end: row.end,
    content: (row.content as AnnotationDTO['content']) ?? [],
  };
}

/**
 * Maps the parsed domain annotation to a flat GraphQL-compatible format.
 * Uses data-access's annotationFromDTO for parsing, then extracts
 * type-specific fields from the domain model.
 */
export function transformAnnotation(row: AnnotationRow): TransformedAnnotation {
  // Convert row to DTO format expected by data-access
  const dto = rowToDTO(row);

  // Use data-access's parsing logic to get the domain model
  // passageLength is not critical here since we're not validating ranges
  const annotation = annotationFromDTO(dto, Number.MAX_SAFE_INTEGER);

  // Build the base response
  const result: TransformedAnnotation = {
    uuid: annotation.uuid,
    type: annotation.type,
    start: annotation.start,
    end: annotation.end,
    // Initialize all type-specific fields as null
    level: null,
    headingClass: null,
    href: null,
    text: null,
    linkType: null,
    label: null,
    entity: null,
    isPending: null,
    textStyle: null,
    lang: null,
    glossary: null,
    endNote: null,
    src: null,
    mediaType: null,
    spacing: null,
    nesting: null,
    itemStyle: null,
    abbreviation: null,
    quote: null,
  };

  // Extract type-specific fields from the parsed domain model
  switch (annotation.type) {
    case 'heading': {
      const heading = annotation as HeadingAnnotation;
      result.level = heading.level;
      result.headingClass = heading.class ?? null;
      break;
    }

    case 'internalLink': {
      const link = annotation as InternalLinkAnnotation;
      result.linkType = link.linkType ?? null;
      result.href = link.href ?? null;
      result.label = link.label ?? null;
      result.entity = link.entity ?? null;
      result.isPending = link.isPending ?? null;
      break;
    }

    case 'link': {
      const link = annotation as LinkAnnotation;
      result.href = link.href ?? null;
      result.text = link.text ?? null;
      break;
    }

    case 'span': {
      const span = annotation as SpanAnnotation;
      result.textStyle = span.textStyle ?? null;
      result.lang = span.lang ?? null;
      break;
    }

    case 'mantra': {
      const mantra = annotation as MantraAnnotation;
      result.lang = mantra.lang ?? null;
      break;
    }

    case 'inlineTitle': {
      const inlineTitle = annotation as InlineTitleAnnotation;
      result.lang = inlineTitle.lang ?? null;
      break;
    }

    case 'audio': {
      const audio = annotation as AudioAnnotation;
      result.src = audio.src ?? null;
      result.mediaType = audio.mediaType ?? null;
      break;
    }

    case 'image': {
      const image = annotation as ImageAnnotation;
      result.src = image.src ?? null;
      break;
    }

    case 'list': {
      const list = annotation as ListAnnotation;
      result.spacing = list.spacing ?? null;
      result.nesting = list.nesting ?? null;
      result.itemStyle = list.itemStyle ?? null;
      break;
    }

    case 'glossaryInstance': {
      const glossary = annotation as GlossaryInstanceAnnotation;
      result.glossary = glossary.glossary ?? null;
      break;
    }

    case 'endNoteLink': {
      const endNote = annotation as EndNoteLinkAnnotation;
      result.endNote = endNote.endNote ?? null;
      result.label = endNote.label ?? null;
      break;
    }

    case 'abbreviation': {
      const abbrev = annotation as AbbreviationAnnotation;
      result.abbreviation = abbrev.abbreviation ?? null;
      break;
    }

    case 'hasAbbreviation': {
      const abbrev = annotation as HasAbbreviationAnnotation;
      result.abbreviation = abbrev.abbreviation ?? null;
      break;
    }

    case 'quote': {
      const quote = annotation as QuoteAnnotation;
      result.quote = quote.quote ?? null;
      break;
    }

    case 'quoted': {
      const quoted = annotation as QuotedAnnotation;
      result.quote = quoted.quote ?? null;
      break;
    }
  }

  return result;
}
