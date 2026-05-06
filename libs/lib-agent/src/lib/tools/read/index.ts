import type { DataClient } from '@eightyfourthousand/data-access';
import type { McpToolDefinition } from '../../types';

import { createGetTranslationTool } from './get-translation';
import { createGetPassageTool } from './get-passage';
import { createGetTranslationPassagesTool } from './get-translation-passages';
import { createSearchTranslationTool } from './search-translation';
import { createGetGlossaryTermTool } from './get-glossary-term';
import { createListGlossaryTermsTool } from './list-glossary-terms';
import { createSearchGlossaryTermsTool } from './search-glossary-terms';
import { createGetGlossaryInstancesTool } from './get-glossary-instances';
import { createGetBibliographyEntryTool } from './get-bibliography-entry';
import { createListWorkBibliographiesTool } from './list-work-bibliographies';
import { createGetImprintTool } from './get-imprint';
import { createGetTocTool } from './get-toc';
import { createLookupEntityTool } from './lookup-entity';
import { createGetWorkTitlesTool } from './get-work-titles';

export function createReadTools(client: DataClient): McpToolDefinition[] {
  return [
    createGetTranslationTool(client),
    createGetPassageTool(client),
    createGetTranslationPassagesTool(client),
    createSearchTranslationTool(client),
    createGetGlossaryTermTool(client),
    createListGlossaryTermsTool(client),
    createSearchGlossaryTermsTool(client),
    createGetGlossaryInstancesTool(client),
    createGetBibliographyEntryTool(client),
    createListWorkBibliographiesTool(client),
    createGetImprintTool(client),
    createGetTocTool(client),
    createLookupEntityTool(client),
    createGetWorkTitlesTool(client),
  ];
}

export { createGetTranslationTool } from './get-translation';
export { createGetPassageTool } from './get-passage';
export { createGetTranslationPassagesTool } from './get-translation-passages';
export { createSearchTranslationTool } from './search-translation';
export { createGetGlossaryTermTool } from './get-glossary-term';
export { createListGlossaryTermsTool } from './list-glossary-terms';
export { createSearchGlossaryTermsTool } from './search-glossary-terms';
export { createGetGlossaryInstancesTool } from './get-glossary-instances';
export { createGetBibliographyEntryTool } from './get-bibliography-entry';
export { createListWorkBibliographiesTool } from './list-work-bibliographies';
export { createGetImprintTool } from './get-imprint';
export { createGetTocTool } from './get-toc';
export { createLookupEntityTool } from './lookup-entity';
export { createGetWorkTitlesTool } from './get-work-titles';
