import type { DataClient } from '@eightyfourthousand/data-access';
import type { McpToolDefinition } from '../../types';

import { createGetTranslationTool } from './get-translation';
import { createGetPassageTool } from './get-passage';
import { createGetPassageAlignmentsTool } from './get-passage-alignments';
import { createGetTranslationPassagesTool } from './get-translation-passages';
import { createGetTranslationFoliosTool } from './get-translation-folios';
import {
  createSearchTranslationTool,
  type SearchTranslationToolOptions,
} from './search-translation';
import { createSearchEntitiesTool } from './search-entities';
import { createGetGlossaryTermTool } from './get-glossary-term';
import { createListGlossaryTermsTool } from './list-glossary-terms';
import { createSearchGlossaryTermsTool } from './search-glossary-terms';
import {
  createGetGlossaryInstancesTool,
  type GetGlossaryInstancesToolOptions,
} from './get-glossary-instances';
import { createGetBibliographyEntryTool } from './get-bibliography-entry';
import { createListWorkBibliographiesTool } from './list-work-bibliographies';
import { createGetImprintTool } from './get-imprint';
import { createGetTocTool } from './get-toc';
import { createLookupEntityTool } from './lookup-entity';
import { createGetWorkTitlesTool } from './get-work-titles';
import { createSearchCanonSectionsTool } from './search-canon-sections';
import { createSearchCanonSectionGlossaryTool } from './search-canon-section-glossary';
import { createResolveTohTool } from './resolve-toh';
import { createTransliterateTool } from '../transliterate';

export type ReadToolsOptions = {
  /** Which copy `search-translation` searches; published by default. */
  searchTranslationSource?: SearchTranslationToolOptions['source'];
  /** Which copy `get-glossary-instances` reads by default; published by default. */
  glossaryInstancesSource?: GetGlossaryInstancesToolOptions['source'];
};

export function createReadTools(
  client: DataClient,
  { searchTranslationSource, glossaryInstancesSource }: ReadToolsOptions = {},
): McpToolDefinition[] {
  return [
    createGetTranslationTool(client),
    createGetPassageTool(client),
    createGetPassageAlignmentsTool(client),
    createGetTranslationPassagesTool(client),
    createGetTranslationFoliosTool(client),
    createSearchTranslationTool(client, { source: searchTranslationSource }),
    createSearchEntitiesTool(client),
    createGetGlossaryTermTool(client),
    createListGlossaryTermsTool(client),
    createSearchGlossaryTermsTool(client),
    createGetGlossaryInstancesTool(client, { source: glossaryInstancesSource }),
    createGetBibliographyEntryTool(client),
    createListWorkBibliographiesTool(client),
    createGetImprintTool(client),
    createGetTocTool(client),
    createLookupEntityTool(client),
    createGetWorkTitlesTool(client),
    createSearchCanonSectionsTool(client),
    createSearchCanonSectionGlossaryTool(client),
    createResolveTohTool(client),
    createTransliterateTool(),
  ];
}

export { createGetTranslationTool } from './get-translation';
export { createGetPassageTool } from './get-passage';
export { createGetPassageAlignmentsTool } from './get-passage-alignments';
export { createGetTranslationPassagesTool } from './get-translation-passages';
export { createGetTranslationFoliosTool } from './get-translation-folios';
export { createSearchTranslationTool } from './search-translation';
export type { SearchTranslationToolOptions } from './search-translation';
export { createSearchEntitiesTool } from './search-entities';
export { createGetGlossaryTermTool } from './get-glossary-term';
export { createListGlossaryTermsTool } from './list-glossary-terms';
export { createSearchGlossaryTermsTool } from './search-glossary-terms';
export { createGetGlossaryInstancesTool } from './get-glossary-instances';
export type { GetGlossaryInstancesToolOptions } from './get-glossary-instances';
export { createGetBibliographyEntryTool } from './get-bibliography-entry';
export { createListWorkBibliographiesTool } from './list-work-bibliographies';
export { createGetImprintTool } from './get-imprint';
export { createGetTocTool } from './get-toc';
export { createLookupEntityTool } from './lookup-entity';
export { createGetWorkTitlesTool } from './get-work-titles';
export { createSearchCanonSectionsTool } from './search-canon-sections';
export { createSearchCanonSectionGlossaryTool } from './search-canon-section-glossary';
export { createResolveTohTool } from './resolve-toh';
