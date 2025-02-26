import { Annotations, AnnotationsDTO, annotationsFromDTO } from './annotation';
import { BackMatter, BackMatterDTO, backMatterFromDTO } from './back-matter';
import {
  FrontMatter,
  FrontMatterDTO,
  frontMatterFromDTO,
} from './front-matter';
import { Passage, PassageDTO, passageFromDTO } from './passage';

export type Body = Passage[];

export type Translation = {
  body: Body;
  backMatter: BackMatter;
  frontMatter: FrontMatter;
  passageAnnotations: Annotations;
};

export type BodyDTO = PassageDTO[];

export type TranslationDTO = {
  body: BodyDTO;
  backMatter: BackMatterDTO;
  frontMatter: FrontMatterDTO;
  passageAnnotations: AnnotationsDTO;
};

export const translationFromDTO = (dto: TranslationDTO): Translation => {
  return {
    body: dto.body?.map((p) => passageFromDTO(p)),
    backMatter: backMatterFromDTO(dto.backMatter),
    frontMatter: frontMatterFromDTO(dto.frontMatter),
    passageAnnotations: annotationsFromDTO(dto.passageAnnotations),
  };
};
