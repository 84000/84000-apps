import type {
  Annotation,
  Annotations,
  AnnotationType,
  HeadingClass,
  ExtendedTranslationLanguage,
} from '@data-access';

/**
 * GraphQL Annotation type from generated code
 */
export type GraphQLAnnotation = {
  uuid: string;
  type: string;
  start: number;
  end: number;
  metadata?: Record<string, unknown> | null;
};

/**
 * Map from DTO-style type names (kebab-case) to internal type names (camelCase)
 */
const typeMap: Record<string, AnnotationType> = {
  abbreviation: 'abbreviation',
  audio: 'audio',
  blockquote: 'blockquote',
  code: 'code',
  'deprecated-internal-link': 'deprecated',
  'end-note-link': 'endNoteLink',
  'glossary-instance': 'glossaryInstance',
  'has-abbreviation': 'hasAbbreviation',
  heading: 'heading',
  image: 'image',
  indent: 'indent',
  'inline-title': 'inlineTitle',
  'internal-link': 'internalLink',
  'leading-space': 'leadingSpace',
  line: 'line',
  'line-group': 'lineGroup',
  link: 'link',
  list: 'list',
  'list-item': 'listItem',
  mantra: 'mantra',
  paragraph: 'paragraph',
  quote: 'quote',
  quoted: 'quoted',
  reference: 'reference',
  span: 'span',
  table: 'table',
  'table-body-data': 'tableBodyData',
  'table-body-header': 'tableBodyHeader',
  'table-body-row': 'tableBodyRow',
  trailer: 'trailer',
  unknown: 'unknown',
  // Also handle camelCase types (from GraphQL)
  endNoteLink: 'endNoteLink',
  glossaryInstance: 'glossaryInstance',
  hasAbbreviation: 'hasAbbreviation',
  inlineTitle: 'inlineTitle',
  internalLink: 'internalLink',
  leadingSpace: 'leadingSpace',
  lineGroup: 'lineGroup',
  listItem: 'listItem',
  tableBodyData: 'tableBodyData',
  tableBodyHeader: 'tableBodyHeader',
  tableBodyRow: 'tableBodyRow',
};

/**
 * Convert a GraphQL annotation to the internal Annotation type
 */
export function annotationFromGraphQL(
  gqlAnnotation: GraphQLAnnotation,
  passageUuid: string,
): Annotation {
  const type = typeMap[gqlAnnotation.type] || 'unknown';
  const metadata = gqlAnnotation.metadata || {};

  const base = {
    uuid: gqlAnnotation.uuid,
    type,
    start: gqlAnnotation.start,
    end: gqlAnnotation.end,
    passageUuid,
    validated: true,
  };

  // Extract type-specific fields from metadata
  switch (type) {
    case 'heading':
      return {
        ...base,
        type: 'heading',
        level: (metadata.level as number) ?? 1,
        class: metadata.class as HeadingClass | undefined,
      };

    case 'link':
      return {
        ...base,
        type: 'link',
        href: (metadata.href as string) ?? '',
        text: (metadata.text as string) ?? '',
      };

    case 'internalLink':
      return {
        ...base,
        type: 'internalLink',
        linkType: (metadata.linkType as string) ?? '',
        href: metadata.href as string | undefined,
        label: metadata.label as string | undefined,
        entity: metadata.entity as string | undefined,
        isPending: metadata.isPending as boolean | undefined,
      };

    case 'span':
      return {
        ...base,
        type: 'span',
        textStyle: metadata.textStyle as string | undefined,
        lang: metadata.lang as ExtendedTranslationLanguage | undefined,
      };

    case 'mantra':
      return {
        ...base,
        type: 'mantra',
        lang: (metadata.lang as ExtendedTranslationLanguage) ?? 'Sa-Ltn',
      };

    case 'inlineTitle':
      return {
        ...base,
        type: 'inlineTitle',
        lang: (metadata.lang as ExtendedTranslationLanguage) ?? 'Sa-Ltn',
      };

    case 'audio':
      return {
        ...base,
        type: 'audio',
        src: (metadata.src as string) ?? '',
        mediaType: (metadata.mediaType as string) ?? '',
      };

    case 'image':
      return {
        ...base,
        type: 'image',
        src: (metadata.src as string) ?? '',
      };

    case 'list':
      return {
        ...base,
        type: 'list',
        spacing: metadata.spacing as string | undefined,
        nesting: metadata.nesting as number | undefined,
        itemStyle: metadata.itemStyle as string | undefined,
      };

    case 'glossaryInstance':
      return {
        ...base,
        type: 'glossaryInstance',
        glossary: (metadata.glossary as string) ?? '',
      };

    case 'endNoteLink':
      return {
        ...base,
        type: 'endNoteLink',
        endNote: (metadata.endNote as string) ?? '',
        label: metadata.label as string | undefined,
      };

    case 'abbreviation':
      return {
        ...base,
        type: 'abbreviation',
        abbreviation: (metadata.abbreviation as string) ?? '',
      };

    case 'hasAbbreviation':
      return {
        ...base,
        type: 'hasAbbreviation',
        abbreviation: (metadata.abbreviation as string) ?? '',
      };

    case 'quote':
      return {
        ...base,
        type: 'quote',
        quote: metadata.quote as string | undefined,
      };

    case 'quoted':
      return {
        ...base,
        type: 'quoted',
        quote: metadata.quote as string | undefined,
      };

    default:
      // For types with no additional fields
      return base as Annotation;
  }
}

/**
 * Convert an array of GraphQL annotations to internal Annotation types
 */
export function annotationsFromGraphQL(
  gqlAnnotations: GraphQLAnnotation[],
  passageUuid: string,
): Annotations {
  // Filter out ignored annotation types
  const ignoredTypes = ['deprecated-internal-link', 'quoted', 'reference', 'unknown'];
  const filtered = gqlAnnotations.filter(
    (a) => !ignoredTypes.includes(a.type),
  );

  return filtered.map((a) => annotationFromGraphQL(a, passageUuid));
}
