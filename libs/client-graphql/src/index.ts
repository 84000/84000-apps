// Client
export {
  createGraphQLClient,
  resetGraphQLClient,
  setAccessTokenProvider,
} from './lib/client';

// Functions
export {
  getPassage,
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
  getGlossaryTerms,
  getGlossaryEntry,
  getGlossaryInstance,
  getWorkGlossary,
  getWorkGlossaryTerms,
  getWorkGlossaryTermsAround,
  type GlossaryTermsPage,
  getTermPassages,
  type GlossaryPassagesPage,
  getBibliographyEntry,
  getWorkBibliography,
  getWorkFolios,
  getWorks,
  hasPermission,
  savePassages,
  type TranslationBlocksPage,
  type WorksPage,
  type Permission,
} from './lib/functions';

// Re-export types from @84000/data-access for convenience
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
} from '@84000/data-access';

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
} from '@84000/data-access';
