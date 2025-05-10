import { TranslationLanguage } from './language';

export type Title = {
  uuid: string;
  title: string;
  language: TranslationLanguage;
  type?: string;
};

export type Titles = Title[];

export type TitleDTO = {
  uuid: string;
  title: string;
  language: TranslationLanguage;
  type?: string;
};

export type TitlesDTO = TitleDTO[];

export const titleFromDTO = (dto: TitleDTO): Title => {
  return {
    uuid: dto.uuid,
    title: dto.title,
    language: dto.language,
    type: dto.type,
  };
};

export const titlesFromDTO = (dto?: TitlesDTO): Titles => {
  return dto?.map(titleFromDTO) || [];
};
