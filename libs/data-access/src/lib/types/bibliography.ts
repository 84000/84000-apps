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
