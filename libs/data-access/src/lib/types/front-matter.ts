import { Annotations } from './annotation';
import { Imprints, ImprintsDTO, imprintsFromDTO } from './imprint';
import { Passage, PassageDTO, passageFromDTO } from './passage';
import { Titles, TitlesDTO, titlesFromDTO } from './title';

export type TohokuCatalogEntry = `toh${number}`;

export type Introductions = Passage[];
export type TableOfContents = Passage[];

export type FrontMatter = {
  toc: TableOfContents;
  toh: TohokuCatalogEntry;
  titles: Titles;
  imprint: Imprints;
  introductions: Introductions;
};

export type IntroductionsDTO = PassageDTO[];
export type TableOfContentsDTO = PassageDTO[];

export type FrontMatterDTO = {
  toc: TableOfContentsDTO;
  toh: TohokuCatalogEntry;
  titles: TitlesDTO;
  imprint: ImprintsDTO;
  introductions: IntroductionsDTO;
};

export const frontMatterFromDTO = (
  dto: FrontMatterDTO,
  annotations: Annotations,
): FrontMatter => {
  return {
    toc:
      dto.toc?.map(
        (p): Passage => ({
          ...passageFromDTO(p),
          type: 'toc',
        }),
      ) || [],
    toh: dto.toh,
    titles: titlesFromDTO(dto.titles),
    imprint: imprintsFromDTO(dto.imprint),
    introductions:
      dto.introductions?.map((intro) => passageFromDTO(intro, annotations)) ||
      [],
  };
};
