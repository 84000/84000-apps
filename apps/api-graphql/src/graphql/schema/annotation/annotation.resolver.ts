import type { AnnotationRow } from '../passage/passage.loader';
import {
  ANNOTATION_DTO_TYPE_TO_ENUM,
  HEADING_CLASS_TO_ENUM,
  LANG_TO_ENUM,
} from './annotation.types';

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
 * Flattens the content array into a single object for easier access
 */
function flattenContent(content: unknown[] | null): Record<string, unknown> {
  if (!content || !Array.isArray(content)) {
    return {};
  }
  return content.reduce<Record<string, unknown>>((acc, item) => {
    if (item && typeof item === 'object') {
      return { ...acc, ...(item as Record<string, unknown>) };
    }
    return acc;
  }, {});
}

/**
 * Transforms a database annotation row into a GraphQL-compatible format
 * with typed fields instead of JSON-stringified content.
 *
 * Field mappings match the data-access library transformers:
 * - glossary-instance: uuid → glossary
 * - end-note-link: uuid → endNote, label → label
 * - quote/quoted: uuid → quote
 * - abbreviation: uuid → abbreviation
 * - internal-link: uuid → entity, type → linkType, link-type='pending' → isPending
 * - link: title → text, href → href
 * - heading: heading-level → level, heading-type → headingClass
 * - span/mantra/inline-title: text-style → textStyle, lang → lang
 * - audio: src → src, media-type → mediaType
 * - list: list-spacing → spacing, nesting → nesting, list-item-style → itemStyle
 */
export function transformAnnotation(
  annotation: AnnotationRow,
): TransformedAnnotation {
  const dtoType = annotation.type;
  const type = ANNOTATION_DTO_TYPE_TO_ENUM[dtoType] ?? 'UNKNOWN';
  const content = flattenContent(annotation.content);

  // Extract language and map to enum
  const rawLang = content['lang'] as string | undefined;
  const lang = rawLang && LANG_TO_ENUM[rawLang] ? LANG_TO_ENUM[rawLang] : null;

  // Extract heading class and map to enum
  const rawHeadingType = content['heading-type'] as string | undefined;
  const headingClass =
    rawHeadingType && HEADING_CLASS_TO_ENUM[rawHeadingType]
      ? HEADING_CLASS_TO_ENUM[rawHeadingType]
      : null;

  // Extract isPending from link-type (only for internal-link)
  const linkTypeValue = content['link-type'] as string | undefined;
  const isPending =
    dtoType === 'internal-link' && linkTypeValue === 'pending' ? true : null;

  // The 'uuid' key in content has different meanings based on annotation type
  const contentUuid = content['uuid'] as string | undefined;
  const level = content['heading-level'] as string | undefined;

  return {
    uuid: annotation.uuid,
    type,
    start: annotation.start,
    end: annotation.end,

    // Heading fields
    level: level ? parseInt(level.replace('h', ''), 10) : null,
    headingClass,

    // Link fields (link type uses 'title' for text)
    href: (content['href'] as string) ?? null,
    text: dtoType === 'link' ? ((content['title'] as string) ?? null) : null,
    linkType:
      dtoType === 'internal-link'
        ? ((content['type'] as string) ?? null)
        : null,
    label: (content['label'] as string) ?? null,
    entity: dtoType === 'internal-link' ? (contentUuid ?? null) : null,
    isPending,

    // Span fields
    textStyle: (content['text-style'] as string) ?? null,
    lang,

    // Glossary fields (glossary-instance uses uuid for glossary reference)
    glossary: dtoType === 'glossary-instance' ? (contentUuid ?? null) : null,

    // End note fields (end-note-link uses uuid for endNote reference)
    endNote: dtoType === 'end-note-link' ? (contentUuid ?? null) : null,

    // Media fields
    src: (content['src'] as string) ?? null,
    mediaType: (content['media-type'] as string) ?? null,

    // List fields
    spacing: (content['list-spacing'] as string) ?? null,
    nesting: (content['nesting'] as number) ?? null,
    itemStyle: (content['list-item-style'] as string) ?? null,

    // Abbreviation fields (abbreviation and has-abbreviation use uuid)
    abbreviation:
      dtoType === 'abbreviation' || dtoType === 'has-abbreviation'
        ? (contentUuid ?? null)
        : null,

    // Quote fields (quote and quoted use uuid for quote reference)
    quote:
      dtoType === 'quote' || dtoType === 'quoted'
        ? (contentUuid ?? null)
        : null,
  };
}
