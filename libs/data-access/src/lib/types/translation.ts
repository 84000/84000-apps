import { AnnotationsDTO, annotationsFromDTO } from './annotation';
import { BackMatter, BackMatterDTO, backMatterFromDTO } from './back-matter';
import {
  FrontMatter,
  FrontMatterDTO,
  frontMatterFromDTO,
} from './front-matter';
import { Passage, PassageDTO, passageFromDTO } from './passage';

export type TranslationNodeClass = 'translation' | 'annotation';

export type Translation = {
  body: Passage[];
  backMatter: BackMatter;
  frontMatter: FrontMatter;
};

export type BodyDTO = PassageDTO[];

export type TranslationDTO = {
  body: BodyDTO;
  backMatter: BackMatterDTO;
  frontMatter: FrontMatterDTO;
  passageAnnotations: AnnotationsDTO;
};

export const translationFromDTO = (dto: TranslationDTO): Translation => {
  const annotations = annotationsFromDTO(dto.passageAnnotations).sort((a, b) =>
    a.uuid < b.uuid ? -1 : 1,
  );
  return {
    body: dto.body?.map((p) => passageFromDTO(p, annotations)),
    backMatter: backMatterFromDTO(dto.backMatter, annotations),
    frontMatter: frontMatterFromDTO(dto.frontMatter, annotations),
  };
};
