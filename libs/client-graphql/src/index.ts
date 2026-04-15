// Client
export {
  createGraphQLClient,
  resetGraphQLClient,
  setAccessTokenProvider,
} from './lib/client';

// Functions
export {
  getPassage,
  getTranslationBlocks,
  getTranslationBlocksAround,
  getTranslationTitles,
  getTranslationMetadataByUuid,
  getTranslationMetadataByToh,
  getTranslationsMetadata,
  getTranslationUuids,
  getTranslationToc,
  getTranslationImprint,
  getGlossaryInstance,
  getWorkGlossaryTerms,
  getWorkGlossaryTermsAround,
  type GlossaryTermsPage,
  getTermPassages,
  type GlossaryPassagesPage,
  getBibliographyEntry,
  getWorkBibliography,
  getWorkFolios,
  hasPermission,
  replace,
  savePassages,
  type TranslationBlocksPage,
  type Permission,
  type ReplaceType,
  type ReplacedPassage,
} from './lib/functions';

// Re-export types from @eightyfourthousand/data-access for convenience
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
  GlossaryTermInstance,
  GlossaryLandingItem,
  GlossaryPageItem,
  BibliographyEntry,
  BibliographyEntryItem,
  BibliographyEntries,
  Folio,
} from '@eightyfourthousand/data-access';

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
} from '@eightyfourthousand/data-access';
