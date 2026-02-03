import type { GraphQLClient, RequestOptions } from 'graphql-request';
import gql from 'graphql-tag';
export type Maybe<T> = T | null;
export type InputMaybe<T> = Maybe<T>;
export type Exact<T extends { [key: string]: unknown }> = { [K in keyof T]: T[K] };
export type MakeOptional<T, K extends keyof T> = Omit<T, K> & { [SubKey in K]?: Maybe<T[SubKey]> };
export type MakeMaybe<T, K extends keyof T> = Omit<T, K> & { [SubKey in K]: Maybe<T[SubKey]> };
export type MakeEmpty<T extends { [key: string]: unknown }, K extends keyof T> = { [_ in K]?: never };
export type Incremental<T> = T | { [P in keyof T]?: P extends ' $fragmentName' | '__typename' ? T[P] : never };
type GraphQLClientRequestHeaders = RequestOptions['requestHeaders'];
/** All built-in and custom scalars, mapped to their actual values */
export type Scalars = {
  ID: { input: string; output: string; }
  String: { input: string; output: string; }
  Boolean: { input: boolean; output: boolean; }
  Int: { input: number; output: number; }
  Float: { input: number; output: number; }
  /** JSON scalar for arbitrary JSON data */
  JSON: { input: any; output: any; }
};

/** An alignment linking a passage to Tibetan source text */
export type Alignment = {
  __typename?: 'Alignment';
  /** Folio number within the volume */
  folioNumber: Scalars['Int']['output'];
  /** UUID of the folio containing the Tibetan source */
  folioUuid: Scalars['ID']['output'];
  /** Tibetan source text content */
  tibetan: Scalars['String']['output'];
  /** Tohoku catalog reference (e.g., "toh123") */
  toh: Scalars['String']['output'];
  /** Volume number */
  volumeNumber: Scalars['Int']['output'];
};

/** An annotation marking up a range within a passage */
export type Annotation = {
  __typename?: 'Annotation';
  /** End offset within the passage content */
  end: Scalars['Int']['output'];
  /**
   * Type-specific metadata. Contents vary by annotation type:
   * - heading: { level, class }
   * - link: { href, text }
   * - internalLink: { linkType, href, label, entity, isPending }
   * - span/mantra/inlineTitle: { textStyle, lang }
   * - audio: { src, mediaType }
   * - image: { src }
   * - list: { spacing, nesting, itemStyle }
   * - glossaryInstance: { glossary }
   * - endNoteLink: { endNote, label }
   * - abbreviation/hasAbbreviation: { abbreviation }
   * - quote/quoted: { quote }
   */
  metadata?: Maybe<Scalars['JSON']['output']>;
  /** Start offset within the passage content */
  start: Scalars['Int']['output'];
  /** Type of annotation (e.g., heading, span, link, internalLink, glossaryInstance) */
  type: Scalars['String']['output'];
  /** Unique identifier for the annotation */
  uuid: Scalars['ID']['output'];
};

/** Currently authenticated user */
export type CurrentUser = {
  __typename?: 'CurrentUser';
  /** User's email address */
  email: Scalars['String']['output'];
  /** User's unique identifier */
  id: Scalars['ID']['output'];
  /** User's role */
  role: UserRole;
};

/** Health status response */
export type HealthStatus = {
  __typename?: 'HealthStatus';
  /** Current status of the API (e.g., "ok", "degraded") */
  status: Scalars['String']['output'];
  /** ISO 8601 timestamp of the health check */
  timestamp: Scalars['String']['output'];
};

/** Publication imprint information for a work */
export type Imprint = {
  __typename?: 'Imprint';
  /** Whether the authorship is contested */
  isAuthorContested: Scalars['Boolean']['output'];
  /** License information */
  license: License;
  /** Long titles by language */
  longTitles?: Maybe<TitlesByLanguage>;
  /** Main titles by language */
  mainTitles?: Maybe<TitlesByLanguage>;
  /** Year the translation was published */
  publishYear?: Maybe<Scalars['String']['output']>;
  /** Publisher statement */
  publisherStatement?: Maybe<Scalars['String']['output']>;
  /** Whether access to this work is restricted */
  restriction?: Maybe<Scalars['Boolean']['output']>;
  /** Section of the canon (e.g., "Sutra") */
  section?: Maybe<Scalars['String']['output']>;
  /** Description of the source text */
  sourceDescription?: Maybe<Scalars['String']['output']>;
  /** Names of Tibetan authors */
  tibetanAuthors?: Maybe<Array<Scalars['String']['output']>>;
  /** Names of Tibetan translators */
  tibetanTranslators?: Maybe<Scalars['String']['output']>;
  /** Tohoku catalog entry number (e.g., "toh1") */
  toh: Scalars['String']['output'];
  /** Publication version (semantic versioning) */
  version?: Maybe<Scalars['String']['output']>;
};

/** License information for a published work */
export type License = {
  __typename?: 'License';
  /** Human-readable description of the license terms */
  description?: Maybe<Scalars['String']['output']>;
  /** URL to the license text */
  link?: Maybe<Scalars['String']['output']>;
  /** Name of the license (e.g., "CC BY-NC-ND 4.0") */
  name?: Maybe<Scalars['String']['output']>;
};

/** Root Mutation type - extend this in other schema files */
export type Mutation = {
  __typename?: 'Mutation';
  /** Placeholder mutation - replace with your actual mutations */
  _placeholder?: Maybe<Scalars['Boolean']['output']>;
};

/** Direction for pagination */
export type PaginationDirection =
  /** Fetch passages around the cursor (both before and after) */
  | 'AROUND'
  /** Fetch passages before the cursor */
  | 'BACKWARD'
  /** Fetch passages after the cursor (default) */
  | 'FORWARD';

/** A passage of text from a work */
export type Passage = {
  __typename?: 'Passage';
  /** Alignments linking this passage to Tibetan source text */
  alignments: Array<Alignment>;
  /** Annotations marking up ranges within this passage */
  annotations: Array<Annotation>;
  /** Text content of the passage */
  content: Scalars['String']['output'];
  /**
   * TipTap editor JSON representation of this passage.
   * Transforms content and annotations into nested JSON structure.
   */
  json?: Maybe<Scalars['JSON']['output']>;
  /** Display label for the passage (e.g., "1.1") */
  label: Scalars['String']['output'];
  /** Sort order within the work */
  sort: Scalars['Int']['output'];
  /** Type of passage content (e.g., translation, introduction, colophon) */
  type: Scalars['String']['output'];
  /** Unique identifier for the passage */
  uuid: Scalars['ID']['output'];
  /** XML ID from the source document */
  xmlId?: Maybe<Scalars['String']['output']>;
};

/** Paginated connection of passages */
export type PassageConnection = {
  __typename?: 'PassageConnection';
  /** Whether there are more passages after the current page */
  hasMoreAfter: Scalars['Boolean']['output'];
  /** Whether there are more passages before the current page */
  hasMoreBefore: Scalars['Boolean']['output'];
  /** Cursor for fetching the next page */
  nextCursor?: Maybe<Scalars['String']['output']>;
  /** List of passages */
  nodes: Array<Passage>;
  /** Cursor for fetching the previous page */
  prevCursor?: Maybe<Scalars['String']['output']>;
};

/** Filter options for passages */
export type PassageFilter = {
  /**
   * Filter by passage type (e.g., translation, introduction, colophon).
   * Can be a single type or use LIKE pattern with %.
   */
  type?: InputMaybe<Scalars['String']['input']>;
  /**
   * Filter by multiple passage types (OR logic).
   * Use this instead of type when filtering by multiple types.
   */
  types?: InputMaybe<Array<Scalars['String']['input']>>;
};

/** Root Query type - extend this in other schema files */
export type Query = {
  __typename?: 'Query';
  /** Health check query */
  health: HealthStatus;
  /** Get the currently authenticated user (null if not authenticated) */
  me?: Maybe<CurrentUser>;
  /** Get the current API version */
  version: Scalars['String']['output'];
  /**
   * Get a single work by UUID or Tohoku catalog number.
   * When both uuid and toh are provided, toh acts as a composite key
   * and will be used as the default for nested resolvers (like imprint).
   */
  work?: Maybe<Work>;
  /** Get all published translation works */
  works: Array<Work>;
};


/** Root Query type - extend this in other schema files */
export type QueryWorkArgs = {
  toh?: InputMaybe<Scalars['String']['input']>;
  uuid?: InputMaybe<Scalars['ID']['input']>;
};

/** A title of a work in a specific language */
export type Title = {
  __typename?: 'Title';
  /** The title text content */
  content: Scalars['String']['output'];
  /** Language code (e.g., "en", "bo", "Sa-Ltn", "Bo-Ltn") */
  language: Scalars['String']['output'];
  /** Type of title (e.g., "mainTitle", "longTitle", "otherTitle", "toh", "shortcode") */
  type: Scalars['String']['output'];
  /** Unique identifier for the title */
  uuid: Scalars['ID']['output'];
};

/** Titles grouped by language */
export type TitlesByLanguage = {
  __typename?: 'TitlesByLanguage';
  /** English title */
  english?: Maybe<Scalars['String']['output']>;
  /** Sanskrit title */
  sanskrit?: Maybe<Scalars['String']['output']>;
  /** Tibetan title */
  tibetan?: Maybe<Scalars['String']['output']>;
  /** Wylie transliteration of Tibetan title */
  wylie?: Maybe<Scalars['String']['output']>;
};

/** Table of contents for a work, organized by major sections */
export type Toc = {
  __typename?: 'Toc';
  /** Back matter entries (endnotes, abbreviations) */
  backMatter: Array<TocEntry>;
  /** Body entries (homage, translation, colophon, etc.) */
  body: Array<TocEntry>;
  /** Front matter entries (acknowledgment, introduction, summary) */
  frontMatter: Array<TocEntry>;
};

/**
 * A hierarchical entry in a work's table of contents.
 *
 * This is a recursive type - each entry can contain nested children entries.
 * Due to GraphQL's explicit nesting requirement, queries must specify the
 * desired depth using fragments.
 *
 * Example query for 3 levels deep:
 *   fragment TocFields on TocEntry {
 *     uuid
 *     content
 *     label
 *     level
 *   }
 *
 *   query {
 *     work(uuid: "...") {
 *       toc {
 *         frontMatter {
 *           ...TocFields
 *           children {
 *             ...TocFields
 *             children {
 *               ...TocFields
 *             }
 *           }
 *         }
 *       }
 *     }
 *   }
 *
 * Maximum query depth is limited to 12 levels.
 */
export type TocEntry = {
  __typename?: 'TocEntry';
  /**
   * Child entries nested under this entry.
   * Must be explicitly queried to desired depth using fragments.
   */
  children: Array<TocEntry>;
  /** Content of the TOC entry (title/heading) */
  content: Scalars['String']['output'];
  /** Optional label for the entry */
  label?: Maybe<Scalars['String']['output']>;
  /** Nesting level (1 for top level, 2+ for nested) */
  level: Scalars['Int']['output'];
  /** Section type (e.g., "introduction", "translation", "colophon") */
  section: Scalars['String']['output'];
  /** Sort order within the section */
  sort: Scalars['Int']['output'];
  /** Unique identifier for the passage */
  uuid: Scalars['ID']['output'];
};

/** User role levels */
export type UserRole =
  | 'ADMIN'
  | 'EDITOR'
  | 'READER'
  | 'SCHOLAR'
  | 'TRANSLATOR';

/** A published translation work from the 84000 canon */
export type Work = {
  __typename?: 'Work';
  /**
   * Publication imprint information.
   * If the work query specified a toh argument, that value will be used.
   * Otherwise, imprint for the first toh in the work is returned.
   */
  imprint?: Maybe<Imprint>;
  /** Number of source pages */
  pages: Scalars['Int']['output'];
  /** Paginated passages from this work */
  passages: PassageConnection;
  /** Date the work was published */
  publicationDate: Scalars['String']['output'];
  /** Semantic version of the publication (e.g., "1.0.0") */
  publicationVersion: Scalars['String']['output'];
  /** Whether access to this work is restricted */
  restriction: Scalars['Boolean']['output'];
  /** Section of the canon this work belongs to */
  section: Scalars['String']['output'];
  /** Title of the work */
  title: Scalars['String']['output'];
  /** All titles associated with this work, in various languages and types */
  titles: Array<Title>;
  /**
   * Table of contents for the work, organized by major sections.
   * Returns a recursive tree structure up to 12 levels deep.
   * See the TocEntry type documentation for query examples.
   */
  toc?: Maybe<Toc>;
  /** Tohoku catalog entry numbers (e.g., ["toh1", "toh2"]) */
  toh: Array<Scalars['String']['output']>;
  /** Unique identifier for the work */
  uuid: Scalars['ID']['output'];
};


/** A published translation work from the 84000 canon */
export type WorkPassagesArgs = {
  cursor?: InputMaybe<Scalars['String']['input']>;
  direction?: InputMaybe<PaginationDirection>;
  filter?: InputMaybe<PassageFilter>;
  limit?: InputMaybe<Scalars['Int']['input']>;
};

export type AlignmentFieldsFragment = { __typename?: 'Alignment', folioUuid: string, toh: string, tibetan: string, folioNumber: number, volumeNumber: number };

export type AnnotationFieldsFragment = { __typename?: 'Annotation', uuid: string, type: string, start: number, end: number, metadata?: any | null };

export type LicenseFieldsFragment = { __typename?: 'License', name?: string | null, link?: string | null, description?: string | null };

export type TitlesByLanguageFieldsFragment = { __typename?: 'TitlesByLanguage', tibetan?: string | null, english?: string | null, wylie?: string | null, sanskrit?: string | null };

export type ImprintFieldsFragment = { __typename?: 'Imprint', toh: string, section?: string | null, version?: string | null, restriction?: boolean | null, publishYear?: string | null, tibetanAuthors?: Array<string> | null, isAuthorContested: boolean, sourceDescription?: string | null, publisherStatement?: string | null, tibetanTranslators?: string | null, license: (
    { __typename?: 'License' }
    & LicenseFieldsFragment
  ), mainTitles?: (
    { __typename?: 'TitlesByLanguage' }
    & TitlesByLanguageFieldsFragment
  ) | null, longTitles?: (
    { __typename?: 'TitlesByLanguage' }
    & TitlesByLanguageFieldsFragment
  ) | null };

export type PassageFieldsFragment = { __typename?: 'Passage', uuid: string, content: string, label: string, sort: number, type: string, xmlId?: string | null };

export type PassageWithAnnotationsFragment = (
  { __typename?: 'Passage', annotations: Array<(
    { __typename?: 'Annotation' }
    & AnnotationFieldsFragment
  )>, alignments: Array<(
    { __typename?: 'Alignment' }
    & AlignmentFieldsFragment
  )> }
  & PassageFieldsFragment
);

export type TitleFieldsFragment = { __typename?: 'Title', uuid: string, content: string, language: string, type: string };

export type TocEntryFieldsFragment = { __typename?: 'TocEntry', uuid: string, content: string, label?: string | null, sort: number, level: number, section: string };

export type TocEntryNestedFragment = (
  { __typename?: 'TocEntry', children: Array<(
    { __typename?: 'TocEntry', children: Array<(
      { __typename?: 'TocEntry', children: Array<(
        { __typename?: 'TocEntry', children: Array<(
          { __typename?: 'TocEntry', children: Array<(
            { __typename?: 'TocEntry' }
            & TocEntryFieldsFragment
          )> }
          & TocEntryFieldsFragment
        )> }
        & TocEntryFieldsFragment
      )> }
      & TocEntryFieldsFragment
    )> }
    & TocEntryFieldsFragment
  )> }
  & TocEntryFieldsFragment
);

export type TocFieldsFragment = { __typename?: 'Toc', frontMatter: Array<(
    { __typename?: 'TocEntry' }
    & TocEntryNestedFragment
  )>, body: Array<(
    { __typename?: 'TocEntry' }
    & TocEntryNestedFragment
  )>, backMatter: Array<(
    { __typename?: 'TocEntry' }
    & TocEntryNestedFragment
  )> };

export type WorkFieldsFragment = { __typename?: 'Work', uuid: string, title: string, toh: Array<string>, publicationDate: string, publicationVersion: string, pages: number, restriction: boolean, section: string };

export type GetPassagesQueryVariables = Exact<{
  uuid: Scalars['ID']['input'];
  cursor?: InputMaybe<Scalars['String']['input']>;
  limit?: InputMaybe<Scalars['Int']['input']>;
  direction?: InputMaybe<PaginationDirection>;
  filter?: InputMaybe<PassageFilter>;
}>;


export type GetPassagesQuery = { __typename?: 'Query', work?: { __typename?: 'Work', uuid: string, passages: { __typename?: 'PassageConnection', nextCursor?: string | null, prevCursor?: string | null, hasMoreAfter: boolean, hasMoreBefore: boolean, nodes: Array<(
        { __typename?: 'Passage' }
        & PassageWithAnnotationsFragment
      )> } } | null };

export type GetPassagesBasicQueryVariables = Exact<{
  uuid: Scalars['ID']['input'];
  cursor?: InputMaybe<Scalars['String']['input']>;
  limit?: InputMaybe<Scalars['Int']['input']>;
  direction?: InputMaybe<PaginationDirection>;
  filter?: InputMaybe<PassageFilter>;
}>;


export type GetPassagesBasicQuery = { __typename?: 'Query', work?: { __typename?: 'Work', uuid: string, passages: { __typename?: 'PassageConnection', nextCursor?: string | null, prevCursor?: string | null, hasMoreAfter: boolean, hasMoreBefore: boolean, nodes: Array<(
        { __typename?: 'Passage' }
        & PassageFieldsFragment
      )> } } | null };

export type GetWorkByUuidQueryVariables = Exact<{
  uuid: Scalars['ID']['input'];
}>;


export type GetWorkByUuidQuery = { __typename?: 'Query', work?: (
    { __typename?: 'Work' }
    & WorkFieldsFragment
  ) | null };

export type GetWorkByTohQueryVariables = Exact<{
  toh: Scalars['String']['input'];
}>;


export type GetWorkByTohQuery = { __typename?: 'Query', work?: (
    { __typename?: 'Work' }
    & WorkFieldsFragment
  ) | null };

export type GetWorkWithTitlesQueryVariables = Exact<{
  uuid: Scalars['ID']['input'];
}>;


export type GetWorkWithTitlesQuery = { __typename?: 'Query', work?: (
    { __typename?: 'Work', titles: Array<(
      { __typename?: 'Title' }
      & TitleFieldsFragment
    )> }
    & WorkFieldsFragment
  ) | null };

export type GetWorkWithImprintQueryVariables = Exact<{
  uuid: Scalars['ID']['input'];
  toh?: InputMaybe<Scalars['String']['input']>;
}>;


export type GetWorkWithImprintQuery = { __typename?: 'Query', work?: (
    { __typename?: 'Work', imprint?: (
      { __typename?: 'Imprint' }
      & ImprintFieldsFragment
    ) | null }
    & WorkFieldsFragment
  ) | null };

export type GetWorkWithTocQueryVariables = Exact<{
  uuid: Scalars['ID']['input'];
}>;


export type GetWorkWithTocQuery = { __typename?: 'Query', work?: (
    { __typename?: 'Work', toc?: (
      { __typename?: 'Toc' }
      & TocFieldsFragment
    ) | null }
    & WorkFieldsFragment
  ) | null };

export type GetAllWorksQueryVariables = Exact<{ [key: string]: never; }>;


export type GetAllWorksQuery = { __typename?: 'Query', works: Array<(
    { __typename?: 'Work' }
    & WorkFieldsFragment
  )> };

export type GetWorkUuidsQueryVariables = Exact<{ [key: string]: never; }>;


export type GetWorkUuidsQuery = { __typename?: 'Query', works: Array<{ __typename?: 'Work', uuid: string }> };

export const LicenseFieldsFragmentDoc = gql`
    fragment LicenseFields on License {
  name
  link
  description
}
    `;
export const TitlesByLanguageFieldsFragmentDoc = gql`
    fragment TitlesByLanguageFields on TitlesByLanguage {
  tibetan
  english
  wylie
  sanskrit
}
    `;
export const ImprintFieldsFragmentDoc = gql`
    fragment ImprintFields on Imprint {
  toh
  section
  version
  restriction
  publishYear
  tibetanAuthors
  isAuthorContested
  sourceDescription
  publisherStatement
  tibetanTranslators
  license {
    ...LicenseFields
  }
  mainTitles {
    ...TitlesByLanguageFields
  }
  longTitles {
    ...TitlesByLanguageFields
  }
}
    `;
export const PassageFieldsFragmentDoc = gql`
    fragment PassageFields on Passage {
  uuid
  content
  label
  sort
  type
  xmlId
}
    `;
export const AnnotationFieldsFragmentDoc = gql`
    fragment AnnotationFields on Annotation {
  uuid
  type
  start
  end
  metadata
}
    `;
export const AlignmentFieldsFragmentDoc = gql`
    fragment AlignmentFields on Alignment {
  folioUuid
  toh
  tibetan
  folioNumber
  volumeNumber
}
    `;
export const PassageWithAnnotationsFragmentDoc = gql`
    fragment PassageWithAnnotations on Passage {
  ...PassageFields
  annotations {
    ...AnnotationFields
  }
  alignments {
    ...AlignmentFields
  }
}
    `;
export const TitleFieldsFragmentDoc = gql`
    fragment TitleFields on Title {
  uuid
  content
  language
  type
}
    `;
export const TocEntryFieldsFragmentDoc = gql`
    fragment TocEntryFields on TocEntry {
  uuid
  content
  label
  sort
  level
  section
}
    `;
export const TocEntryNestedFragmentDoc = gql`
    fragment TocEntryNested on TocEntry {
  ...TocEntryFields
  children {
    ...TocEntryFields
    children {
      ...TocEntryFields
      children {
        ...TocEntryFields
        children {
          ...TocEntryFields
          children {
            ...TocEntryFields
          }
        }
      }
    }
  }
}
    `;
export const TocFieldsFragmentDoc = gql`
    fragment TocFields on Toc {
  frontMatter {
    ...TocEntryNested
  }
  body {
    ...TocEntryNested
  }
  backMatter {
    ...TocEntryNested
  }
}
    `;
export const WorkFieldsFragmentDoc = gql`
    fragment WorkFields on Work {
  uuid
  title
  toh
  publicationDate
  publicationVersion
  pages
  restriction
  section
}
    `;
export const GetPassagesDocument = gql`
    query GetPassages($uuid: ID!, $cursor: String, $limit: Int, $direction: PaginationDirection, $filter: PassageFilter) {
  work(uuid: $uuid) {
    uuid
    passages(cursor: $cursor, limit: $limit, direction: $direction, filter: $filter) {
      nodes {
        ...PassageWithAnnotations
      }
      nextCursor
      prevCursor
      hasMoreAfter
      hasMoreBefore
    }
  }
}
    ${PassageWithAnnotationsFragmentDoc}
${PassageFieldsFragmentDoc}
${AnnotationFieldsFragmentDoc}
${AlignmentFieldsFragmentDoc}`;
export const GetPassagesBasicDocument = gql`
    query GetPassagesBasic($uuid: ID!, $cursor: String, $limit: Int, $direction: PaginationDirection, $filter: PassageFilter) {
  work(uuid: $uuid) {
    uuid
    passages(cursor: $cursor, limit: $limit, direction: $direction, filter: $filter) {
      nodes {
        ...PassageFields
      }
      nextCursor
      prevCursor
      hasMoreAfter
      hasMoreBefore
    }
  }
}
    ${PassageFieldsFragmentDoc}`;
export const GetWorkByUuidDocument = gql`
    query GetWorkByUuid($uuid: ID!) {
  work(uuid: $uuid) {
    ...WorkFields
  }
}
    ${WorkFieldsFragmentDoc}`;
export const GetWorkByTohDocument = gql`
    query GetWorkByToh($toh: String!) {
  work(toh: $toh) {
    ...WorkFields
  }
}
    ${WorkFieldsFragmentDoc}`;
export const GetWorkWithTitlesDocument = gql`
    query GetWorkWithTitles($uuid: ID!) {
  work(uuid: $uuid) {
    ...WorkFields
    titles {
      ...TitleFields
    }
  }
}
    ${WorkFieldsFragmentDoc}
${TitleFieldsFragmentDoc}`;
export const GetWorkWithImprintDocument = gql`
    query GetWorkWithImprint($uuid: ID!, $toh: String) {
  work(uuid: $uuid, toh: $toh) {
    ...WorkFields
    imprint {
      ...ImprintFields
    }
  }
}
    ${WorkFieldsFragmentDoc}
${ImprintFieldsFragmentDoc}
${LicenseFieldsFragmentDoc}
${TitlesByLanguageFieldsFragmentDoc}`;
export const GetWorkWithTocDocument = gql`
    query GetWorkWithToc($uuid: ID!) {
  work(uuid: $uuid) {
    ...WorkFields
    toc {
      ...TocFields
    }
  }
}
    ${WorkFieldsFragmentDoc}
${TocFieldsFragmentDoc}
${TocEntryNestedFragmentDoc}
${TocEntryFieldsFragmentDoc}`;
export const GetAllWorksDocument = gql`
    query GetAllWorks {
  works {
    ...WorkFields
  }
}
    ${WorkFieldsFragmentDoc}`;
export const GetWorkUuidsDocument = gql`
    query GetWorkUuids {
  works {
    uuid
  }
}
    `;

export type SdkFunctionWrapper = <T>(action: (requestHeaders?:Record<string, string>) => Promise<T>, operationName: string, operationType?: string, variables?: any) => Promise<T>;


const defaultWrapper: SdkFunctionWrapper = (action, _operationName, _operationType, _variables) => action();

export function getSdk(client: GraphQLClient, withWrapper: SdkFunctionWrapper = defaultWrapper) {
  return {
    GetPassages(variables: GetPassagesQueryVariables, requestHeaders?: GraphQLClientRequestHeaders, signal?: RequestInit['signal']): Promise<GetPassagesQuery> {
      return withWrapper((wrappedRequestHeaders) => client.request<GetPassagesQuery>({ document: GetPassagesDocument, variables, requestHeaders: { ...requestHeaders, ...wrappedRequestHeaders }, signal }), 'GetPassages', 'query', variables);
    },
    GetPassagesBasic(variables: GetPassagesBasicQueryVariables, requestHeaders?: GraphQLClientRequestHeaders, signal?: RequestInit['signal']): Promise<GetPassagesBasicQuery> {
      return withWrapper((wrappedRequestHeaders) => client.request<GetPassagesBasicQuery>({ document: GetPassagesBasicDocument, variables, requestHeaders: { ...requestHeaders, ...wrappedRequestHeaders }, signal }), 'GetPassagesBasic', 'query', variables);
    },
    GetWorkByUuid(variables: GetWorkByUuidQueryVariables, requestHeaders?: GraphQLClientRequestHeaders, signal?: RequestInit['signal']): Promise<GetWorkByUuidQuery> {
      return withWrapper((wrappedRequestHeaders) => client.request<GetWorkByUuidQuery>({ document: GetWorkByUuidDocument, variables, requestHeaders: { ...requestHeaders, ...wrappedRequestHeaders }, signal }), 'GetWorkByUuid', 'query', variables);
    },
    GetWorkByToh(variables: GetWorkByTohQueryVariables, requestHeaders?: GraphQLClientRequestHeaders, signal?: RequestInit['signal']): Promise<GetWorkByTohQuery> {
      return withWrapper((wrappedRequestHeaders) => client.request<GetWorkByTohQuery>({ document: GetWorkByTohDocument, variables, requestHeaders: { ...requestHeaders, ...wrappedRequestHeaders }, signal }), 'GetWorkByToh', 'query', variables);
    },
    GetWorkWithTitles(variables: GetWorkWithTitlesQueryVariables, requestHeaders?: GraphQLClientRequestHeaders, signal?: RequestInit['signal']): Promise<GetWorkWithTitlesQuery> {
      return withWrapper((wrappedRequestHeaders) => client.request<GetWorkWithTitlesQuery>({ document: GetWorkWithTitlesDocument, variables, requestHeaders: { ...requestHeaders, ...wrappedRequestHeaders }, signal }), 'GetWorkWithTitles', 'query', variables);
    },
    GetWorkWithImprint(variables: GetWorkWithImprintQueryVariables, requestHeaders?: GraphQLClientRequestHeaders, signal?: RequestInit['signal']): Promise<GetWorkWithImprintQuery> {
      return withWrapper((wrappedRequestHeaders) => client.request<GetWorkWithImprintQuery>({ document: GetWorkWithImprintDocument, variables, requestHeaders: { ...requestHeaders, ...wrappedRequestHeaders }, signal }), 'GetWorkWithImprint', 'query', variables);
    },
    GetWorkWithToc(variables: GetWorkWithTocQueryVariables, requestHeaders?: GraphQLClientRequestHeaders, signal?: RequestInit['signal']): Promise<GetWorkWithTocQuery> {
      return withWrapper((wrappedRequestHeaders) => client.request<GetWorkWithTocQuery>({ document: GetWorkWithTocDocument, variables, requestHeaders: { ...requestHeaders, ...wrappedRequestHeaders }, signal }), 'GetWorkWithToc', 'query', variables);
    },
    GetAllWorks(variables?: GetAllWorksQueryVariables, requestHeaders?: GraphQLClientRequestHeaders, signal?: RequestInit['signal']): Promise<GetAllWorksQuery> {
      return withWrapper((wrappedRequestHeaders) => client.request<GetAllWorksQuery>({ document: GetAllWorksDocument, variables, requestHeaders: { ...requestHeaders, ...wrappedRequestHeaders }, signal }), 'GetAllWorks', 'query', variables);
    },
    GetWorkUuids(variables?: GetWorkUuidsQueryVariables, requestHeaders?: GraphQLClientRequestHeaders, signal?: RequestInit['signal']): Promise<GetWorkUuidsQuery> {
      return withWrapper((wrappedRequestHeaders) => client.request<GetWorkUuidsQuery>({ document: GetWorkUuidsDocument, variables, requestHeaders: { ...requestHeaders, ...wrappedRequestHeaders }, signal }), 'GetWorkUuids', 'query', variables);
    }
  };
}
export type Sdk = ReturnType<typeof getSdk>;