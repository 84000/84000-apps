import { TohokuCatalogEntry } from './toh';
import { SemVer } from './semver';

export type Work = {
  uuid: string;
  title: string;
  description?: string;
  toh: TohokuCatalogEntry[];
  tibetanTitle?: string;
  wylieTitle?: string;
  sanskritTitle?: string;
  publicationDate?: Date;
  publicationVersion: SemVer;
  pages: number;
  restriction: boolean;
  section: string;
  /**
   * The live published version, or undefined for a work that has never been
   * published. The reader uses it to tell "not yet published" apart from
   * "does not exist"; it is the same pointer the published_*_live views join on.
   */
  publishedVersionUuid?: string;
};

export type WorkDTO = {
  uuid: string;
  title?: string;
  description?: string;
  tohs: { toh: TohokuCatalogEntry }[];
  publicationDate: string;
  publicationVersion: string;
  pages: number;
  restriction: boolean;
  breadcrumb?: string;
  published_version_uuid?: string | null;
};

export const workFromDTO = (dto: WorkDTO) => ({
  uuid: dto.uuid,
  title: dto.title || '<Untitled>',
  description: dto.description || '',
  toh: dto.tohs.map((t) => t.toh) as TohokuCatalogEntry[],
  publicationDate: dto.publicationDate ? new Date(dto.publicationDate) : undefined,
  publicationVersion: (dto.publicationVersion || '0.0.0') as SemVer,
  pages: dto.pages || 0,
  restriction: dto.restriction,
  section: dto.breadcrumb?.split('>').at(-2)?.trim() || '',
  publishedVersionUuid: dto.published_version_uuid ?? undefined,
});
