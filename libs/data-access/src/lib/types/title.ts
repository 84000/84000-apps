import { ExtendedTranslationLanguage } from './language';

export const TITLE_TYPES = [
  'toh',
  'mainTitle',
  'mainTitleOutsideCatalogueSection',
  'longTitle',
  'otherTitle',
  'shortcode',
] as const;

export type TitleType = (typeof TITLE_TYPES)[number];

export type TitleTypeDTO = `eft:${TitleType}`;

export type Title = {
  uuid: string;
  title: string;
  language: ExtendedTranslationLanguage;
  type: TitleType;
};

export type Titles = Title[];

export type TitleDTO = {
  uuid: string;
  title: string;
  language: ExtendedTranslationLanguage;
  type: TitleTypeDTO;
};

export type TitlesDTO = TitleDTO[];

export const titleFromDTO = (dto: TitleDTO): Title => {
  return {
    uuid: dto.uuid,
    title: dto.title,
    language: dto.language,
    type: dto.type.replace('eft:', '') as TitleType,
  };
};

export const titlesFromDTO = (dto?: TitlesDTO): Titles => {
  return dto?.map(titleFromDTO) || [];
};
