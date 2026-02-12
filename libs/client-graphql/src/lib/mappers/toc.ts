import type { Toc, TocEntry, TranslationSection } from '@data-access';

/**
 * GraphQL TocEntry type
 */
export type GraphQLTocEntry = {
  uuid: string;
  content: string;
  label?: string | null;
  sort: number;
  level: number;
  section: string;
  children?: GraphQLTocEntry[] | null;
};

/**
 * GraphQL Toc type
 */
export type GraphQLToc = {
  frontMatter: GraphQLTocEntry[];
  body: GraphQLTocEntry[];
  backMatter: GraphQLTocEntry[];
};

/**
 * Convert a GraphQL TocEntry to the internal TocEntry type
 */
function tocEntryFromGraphQL(gqlEntry: GraphQLTocEntry): TocEntry {
  return {
    uuid: gqlEntry.uuid,
    content: gqlEntry.content,
    label: gqlEntry.label || undefined,
    sort: gqlEntry.sort,
    level: gqlEntry.level,
    section: gqlEntry.section as TranslationSection,
    children: (gqlEntry.children || []).map(tocEntryFromGraphQL),
  };
}

/**
 * Convert a GraphQL Toc to the internal Toc type
 */
export function tocFromGraphQL(gqlToc: GraphQLToc): Toc {
  return {
    frontMatter: gqlToc.frontMatter.map(tocEntryFromGraphQL),
    body: gqlToc.body.map(tocEntryFromGraphQL),
    backMatter: gqlToc.backMatter.map(tocEntryFromGraphQL),
  };
}
