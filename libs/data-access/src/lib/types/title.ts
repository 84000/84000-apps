import { TranslationLanguage } from './language';

export type Title = {
  uuid: string;
  title: string;
  language: TranslationLanguage;
};

export type Titles = Title[];

export type TitleDTO = {
  uuid: string;
  title: string;
  language: TranslationLanguage;
};

export type TitlesDTO = TitleDTO[];

export const titleFromDTO = (dto: TitleDTO): Title => {
  return {
    uuid: dto.uuid,
    title: dto.title,
    language: dto.language,
  };
};

export const titlesFromDTO = (dto?: TitlesDTO): Titles => {
  return dto?.map(titleFromDTO) || [];
};
