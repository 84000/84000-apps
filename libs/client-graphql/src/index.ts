// Client
export { createGraphQLClient, resetGraphQLClient } from './lib/client';

// Functions
export {
  getTranslationPassages,
  getTranslationPassagesAround,
  getTranslationBlocks,
  getTranslationBlocksAround,
  getTranslationTitles,
  getTranslationMetadataByUuid,
  getTranslationMetadataByToh,
  getTranslationsMetadata,
  getTranslationUuids,
  getTranslationToc,
  getTranslationImprint,
  type TranslationBlocksPage,
} from './lib/functions';

// Re-export types from @data-access for convenience
export type {
  Passage,
  Passages,
  PassagesPage,
  PaginationDirection,
  BodyItemType,
  Annotation,
  Annotations,
  Alignment,
  Work,
  Title,
  Titles,
  TitleType,
  Toc,
  TocEntry,
  Imprint,
} from '@data-access';

// Re-export constants for passage filters
export {
  BODY_ITEM_TYPES,
  FRONT_MATTER,
  FRONT_MATTER_FILTER,
  BODY_MATTER,
  BODY_MATTER_FILTER,
  BACK_MATTER,
  BACK_MATTER_FILTER,
  COMPARE_MODE,
  COMPARE_MODE_FILTER,
} from '@data-access';
