export type BibliographyItem = {
  content?: string;
  title: string;
  uuid: string;
  year: string;
  publisher: string;
};

export type Bibliography = BibliographyItem[];

export type BibliographyItemDTO = {
  content?: string;
  title: string;
  uuid: string;
  year: string;
  publisher: string;
};

export type BibliographyDTO = BibliographyItemDTO[];

export const bibliographyItemFromDTO = (
  dto: BibliographyItemDTO
): BibliographyItem => {
  return {
    content: dto.content,
    title: dto.title,
    uuid: dto.uuid,
    year: dto.year,
    publisher: dto.publisher,
  };
};

export const bibliographyFromDTO = (dto: BibliographyDTO): Bibliography => {
  return dto.map(bibliographyItemFromDTO);
};
