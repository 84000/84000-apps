export type BibliographyItem = {
  content?: string | null;
  title: string;
  uuid: string;
  year: string;
  publisher: string;
};

export type Bibliography = BibliographyItem[];

export type BibliographyItemDTO = {
  content?: string | null;
  title: string;
  uuid: string;
  year: string;
  publisher: string;
};

export type BibliographyDTO = BibliographyItemDTO[];

export const bibliographyItemFromDTO = (
  dto: BibliographyItemDTO,
): BibliographyItem => {
  return {
    content: dto.content,
    title: dto.title,
    uuid: dto.uuid,
    year: dto.year,
    publisher: dto.publisher,
  };
};

export type BibliographyEntryItemDTO = {
  uuid: string;
  bibl_html: string;
  work_uuid?: string;
  label?: string;
};

export type BibliographyEntryItem = {
  uuid: string;
  html: string;
  workUuid?: string;
  label?: string;
};

export type BlibliographyEntryDTO = {
  heading?: string;
  label?: string;
  entries: BibliographyEntryItemDTO[];
};

export type BibliographyEntry = {
  heading?: string;
  label?: string;
  entries: BibliographyEntryItem[];
};

export type BibliographyEntriesDTO = BlibliographyEntryDTO[];

export type BibliographyEntries = BibliographyEntry[];

export const bibliographyEntryItemFromDTO = (
  dto: BibliographyEntryItemDTO,
): BibliographyEntryItem => {
  return {
    uuid: dto.uuid,
    label: dto.label,
    html: dto.bibl_html,
    workUuid: dto.work_uuid,
  };
};

export const bibliographyEntryFromDTO = (
  dto: BlibliographyEntryDTO,
): BibliographyEntry => {
  return {
    heading: dto.heading,
    label: dto.label,
    entries: dto.entries?.map(bibliographyEntryItemFromDTO) || [],
  };
};

export const bibliographyEntriesFromDTO = (
  dtos: BibliographyEntriesDTO,
): BibliographyEntries => {
  return dtos?.map(bibliographyEntryFromDTO) || [];
};

export const bibliographyFromDTO = (dto?: BibliographyDTO): Bibliography => {
  return dto?.map(bibliographyItemFromDTO) || [];
};

/**
 * One row of `bibliographies` as the editor reads and writes it: flat, in
 * `sort` order, with the nesting the readers' two-level shape hides.
 */
export type BibliographyRowDTO = {
  uuid: string;
  work_uuid: string;
  bibl_html: string;
  sort: number;
  is_heading: boolean;
  heading_uuid: string | null;
};

/**
 * A bibliography heading or entry.
 *
 * `html` is the stored `bibl_html`. An entry's is an HTML fragment; a
 * heading's is plain text, which is how the readers render it and how publish
 * reads a heading's text. `headingUuid` is the heading the row sits under: a
 * heading for an entry or a nested heading, `null` at the top level.
 */
export type BibliographyRow = {
  uuid: string;
  workUuid: string;
  html: string;
  sort: number;
  isHeading: boolean;
  headingUuid: string | null;
};

export const bibliographyRowFromDTO = (
  dto: BibliographyRowDTO,
): BibliographyRow => ({
  uuid: dto.uuid,
  workUuid: dto.work_uuid,
  html: dto.bibl_html,
  sort: dto.sort,
  isHeading: dto.is_heading,
  headingUuid: dto.heading_uuid ?? null,
});

export const bibliographyRowToDTO = (
  row: BibliographyRow,
): BibliographyRowDTO => ({
  uuid: row.uuid,
  work_uuid: row.workUuid,
  bibl_html: row.html,
  sort: row.sort,
  is_heading: row.isHeading,
  heading_uuid: row.headingUuid,
});
