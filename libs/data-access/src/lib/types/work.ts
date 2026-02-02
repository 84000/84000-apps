import { TohokuCatalogEntry } from './toh';
import { SemVer } from './semver';

export type Work = {
  uuid: string;
  title: string;
  description?: string;
  toh: TohokuCatalogEntry[];
  publicationDate: Date;
  publicationVersion: SemVer;
  pages: number;
  restriction: boolean;
  section: string;
};

export type WorkDTO = {
  uuid: string;
  title: string;
  description?: string;
  toh: string;
  publicationDate: string;
  publicationVersion: string;
  pages: number;
  restriction: boolean;
  breadcrumb: string;
};

export function workFromDTO(dto: WorkDTO): Work {
  return {
    uuid: dto.uuid,
    title: dto.title,
    description: dto.description,
    toh: dto.toh?.split(',') as TohokuCatalogEntry[],
    publicationDate: new Date(dto.publicationDate),
    publicationVersion: dto.publicationVersion as SemVer,
    pages: dto.pages,
    restriction: dto.restriction,
    section: dto.breadcrumb?.split('>').at(-2)?.trim() || '',
  };
}
