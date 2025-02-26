import { Contributors, ContributorsDTO } from './contributor';
import { SemVer } from './semver';

export type Imprint = {
  uuid: string;
  publisher: string;
  description: string;
  contributors: Contributors;
  publicationDate: string;
  englishTranslator: string;
  publicationStatus: string;
  publicationVersion: SemVer;
};

export type Imprints = Imprint[];

export type ImprintDTO = {
  uuid: string;
  publisher: string;
  description: string;
  contributors: ContributorsDTO;
  publicationdate: string;
  englishtranslator: string;
  publicationstatus: string;
  publicationversion: SemVer;
};

export type ImprintsDTO = ImprintDTO[];

export const imprintFromDTO = (dto: ImprintDTO): Imprint => {
  return {
    uuid: dto.uuid,
    publisher: dto.publisher,
    description: dto.description,
    contributors: dto.contributors,
    publicationDate: dto.publicationdate,
    englishTranslator: dto.englishtranslator,
    publicationStatus: dto.publicationstatus,
    publicationVersion: dto.publicationversion,
  };
};

export const imprintsFromDTO = (dto: ImprintsDTO): Imprints => {
  return dto.map(imprintFromDTO);
};
