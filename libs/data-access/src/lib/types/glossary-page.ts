import { removeHtmlTags } from '@eightyfourthousand/lib-utils';
import { TohokuCatalogEntry } from './toh';
import {
  ExtendedTranslationLanguage,
  displayLanguageForTranslationLanguage,
} from './language';

export type GlossaryPageLanguage =
  | 'english'
  | 'tibetan'
  | 'sanskrit'
  | 'pali'
  | 'chinese';

export type GlossaryLandingItem = {
  uuid: string;
  headword: string;
  type: string;
  language: string;
  nameVariants: string;
  definition: string;
  numGlossaryEntries: number;
};

export type LanguageRecord = Record<GlossaryPageLanguage, string[]>;

export type GlossaryDetailItem = LanguageRecord & {
  authorityUuid: string;
  headword: string;
  language: GlossaryPageLanguage;
  classifications: string[];
  definition?: string;
  xmlId?: string;
};

export type GlossaryPageItem = GlossaryDetailItem & {
  relatedInstances: GlossaryInstance[];
  relatedEntities: GlossaryEntity[];
};

export type GlossaryInstance = LanguageRecord & {
  workUuid: string;
  toh: TohokuCatalogEntry;
  definition?: string;
  canon?: string;
  creators: string[];
};

export type GlossaryEntity = {
  sourceHeadword: string;
  sourceUuid: string;
  targetHeadword: string;
  targetUuid: string;
};
export type GlossaryLandingItemDTO = {
  authority_uuid: string;
  headword: string;
  type: string;
  headword_language?: ExtendedTranslationLanguage;
  name_variants?: string;
  definition?: string;
  num_glossary_entries?: number;
};

export const glossaryLandingItemFromDTO = (
  dto?: GlossaryLandingItemDTO,
): GlossaryLandingItem | null => {
  if (!dto) {
    return null;
  }

  const definition = removeHtmlTags(dto.definition || '');
  const language = dto.headword_language
    ? displayLanguageForTranslationLanguage(dto.headword_language)
    : '';

  return {
    uuid: dto.authority_uuid,
    headword: dto.headword,
    type: dto.type.replace('Authority > ', ''),
    language,
    nameVariants: dto.name_variants || '',
    definition,
    numGlossaryEntries: dto.num_glossary_entries || 0,
  };
};
