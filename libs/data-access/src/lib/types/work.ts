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
  /**
   * The label of the version currently published, or undefined for a work never
   * published.
   *
   * Prefer this over `publicationVersion`, which is a text column on `works` that
   * the publish pipeline never writes: the two agree only until a work is
   * republished, after which the legacy column names a version that is no longer
   * being served.
   */
  publishedVersion?: SemVer;
  /**
   * The editorial publication status code, e.g. `1`, `1.a`, `2.h`, `3`.
   *
   * A major segment of `1` means published; everything else is a stage on the way
   * there. This is the authority on whether a work is published — not the version
   * number, and not the presence of a published snapshot, which a public work can
   * lack if it has never been through the versioning pipeline.
   */
  publicationStatus?: string;
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
  publicationStatus?: string | null;
};

export const workFromDTO = (dto: WorkDTO) => ({
  uuid: dto.uuid,
  title: dto.title || '<Untitled>',
  description: dto.description || '',
  toh: dto.tohs.map((t) => t.toh) as TohokuCatalogEntry[],
  publicationDate: dto.publicationDate
    ? new Date(dto.publicationDate)
    : undefined,
  publicationVersion: (dto.publicationVersion || '0.0.0') as SemVer,
  pages: dto.pages || 0,
  restriction: dto.restriction,
  section: dto.breadcrumb?.split('>').at(-2)?.trim() || '',
  publishedVersionUuid: dto.published_version_uuid ?? undefined,
  publicationStatus: dto.publicationStatus ?? undefined,
});

/**
 * Whether a work is published, per its `publicationStatus` code.
 *
 * A major segment of `1` (`1`, `1.a`, …) is published; `0`, `2.x`, `3` and `4` are stages
 * before that. Measured against production: every one of the 456 works with a major of 1
 * carries a publication date, and none of the other 3,833 does.
 *
 * Deliberately not derived from the version number, which the previous
 * `isPublishedVersion` heuristic used: that read three works wrongly, because a published
 * work can sit below 1.0.0 and an unpublished one can carry a legacy label above it. Nor
 * from the published snapshot pointer, which two public works legitimately lack — they have
 * never been through the versioning pipeline because their legacy label is not SemVer.
 */
export const isPublishedStatus = (status?: string | null): boolean =>
  (status ?? '').split('.')[0] === '1';
