import { removeHtmlTags } from '@lib-utils';
import { TohokuCatalogEntry } from './front-matter';
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

export type GlossaryDetailDTO = {
  authority_uuid: string;
  xmlId?: string;
  headword: string;
  headword_language?: GlossaryPageLanguage | null;
  classifications?: string[] | null;
  definition?: string | null;
  tibetan_names?: string[] | null;
  sanskrit_names?: string[] | null;
  pali_names?: string[] | null;
  chinese_names?: string[] | null;
  english_names?: string[] | null;
};

export type GlossaryEntityDTO = {
  related_entity_object_headword: string;
  related_entity_object_uuid: string;
  related_entity_subject_headword: string;
  related_entity_subject_uuid: string;
};

export type GlossaryInstanceDTO = {
  glossary_entry_work_uuid: string;
  glossary_entry_toh: TohokuCatalogEntry;
  glossary_entry_english?: string | null;
  glossary_entry_tibetan?: string | null;
  glossary_entry_sanskrit?: string | null;
  glossary_entry_chinese?: string | null;
  glossary_entry_pali?: string | null;
  glossary_entry_definition?: string | null;
  glossary_entry_canon?: string | null;
  glossary_entry_creators?: string[] | null;
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

export const glossaryDetailFromDTO = (
  dto?: GlossaryDetailDTO,
): GlossaryDetailItem | null => {
  if (!dto) {
    return null;
  }

  return {
    authorityUuid: dto.authority_uuid,
    headword: dto.headword,
    language: dto.headword_language as GlossaryPageLanguage,
    classifications: dto.classifications || [],
    definition: dto.definition || undefined,
    xmlId: dto.xmlId,
    english: dto.english_names || [],
    tibetan: dto.tibetan_names || [],
    sanskrit: dto.sanskrit_names || [],
    pali: dto.pali_names || [],
    chinese: dto.chinese_names || [],
  };
};

export const glossaryInstanceFromDTO = (
  dto?: GlossaryInstanceDTO,
): GlossaryInstance | null => {
  if (!dto) {
    return null;
  }

  return {
    workUuid: dto.glossary_entry_work_uuid,
    toh: dto.glossary_entry_toh,
    definition: dto.glossary_entry_definition || undefined,
    canon: dto.glossary_entry_canon || undefined,
    english: dto.glossary_entry_english ? [dto.glossary_entry_english] : [],
    tibetan: dto.glossary_entry_tibetan ? [dto.glossary_entry_tibetan] : [],
    sanskrit: dto.glossary_entry_sanskrit ? [dto.glossary_entry_sanskrit] : [],
    pali: dto.glossary_entry_pali ? [dto.glossary_entry_pali] : [],
    chinese: dto.glossary_entry_chinese ? [dto.glossary_entry_chinese] : [],
    creators: dto.glossary_entry_creators || [],
  };
};

export const glossaryEntityFromDTO = (
  dto?: GlossaryEntityDTO,
): GlossaryEntity | null => {
  if (!dto) {
    return null;
  }

  return {
    sourceHeadword: dto.related_entity_subject_headword,
    sourceUuid: dto.related_entity_subject_uuid,
    targetHeadword: dto.related_entity_object_headword,
    targetUuid: dto.related_entity_object_uuid,
  };
};

export const glossaryPageItemFromDTO = (
  detail: GlossaryDetailDTO,
  instances: GlossaryInstanceDTO[],
  entities: GlossaryEntityDTO[],
): GlossaryPageItem => {
  const detailItem = glossaryDetailFromDTO(detail);
  if (!detailItem) {
    throw new Error('Invalid glossary detail item');
  }

  const relatedInstances =
    instances
      .map(glossaryInstanceFromDTO)
      .filter((i): i is GlossaryInstance => i !== null) || [];
  const relatedEntities =
    entities
      .map(glossaryEntityFromDTO)
      .filter((e): e is GlossaryEntity => e !== null) || [];

  return {
    ...detailItem,
    relatedInstances,
    relatedEntities,
  };
};
