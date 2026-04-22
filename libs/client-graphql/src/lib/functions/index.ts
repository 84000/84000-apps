export { getPassage } from './get-passage';
export {
  getTranslationBlocks,
  type TranslationBlocksPage,
} from './get-translation-blocks';
export { getTranslationBlocksAround } from './get-translation-blocks-around';
export { getTranslationTitles } from './get-translation-titles';
export {
  getTranslationMetadataByUuid,
  getTranslationMetadataByToh,
} from './get-translation-metadata';
export { getTranslationsMetadata } from './get-translations-metadata';
export { getTranslationUuids } from './get-translation-uuids';
export { getTranslationToc } from './get-translation-toc';
export { getTranslationImprint } from './get-translation-imprint';
export { getGlossaryInstance } from './get-glossary-instance';
export {
  getWorkGlossaryTerms,
  type GlossaryTermsPage,
} from './get-work-glossary-terms';
export { getWorkGlossaryTermsAround } from './get-work-glossary-terms-around';
export {
  searchWorkGlossaryTerms,
  type GlossaryTermSearchResult,
} from './search-work-glossary-terms';
export { getTermPassages, type GlossaryPassagesPage } from './get-term-passages';
export { getBibliographyEntry } from './get-bibliography-entry';
export { getWorkBibliography } from './get-work-bibliography';
export { getWorkFolios } from './get-work-folios';
export { hasPermission, type Permission } from './has-permission';
export { replace, type ReplaceType, type ReplacedPassage } from './replace';
export { savePassages } from './save-passages';
