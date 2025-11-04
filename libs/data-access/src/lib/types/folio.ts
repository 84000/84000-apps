export const FOLIO_SIDES = ['a', 'b'] as const;
export type FolioSide = (typeof FOLIO_SIDES)[number];

export type FolioDTO = {
  content: string;
  volume_number: number;
  folio_number: number;
  side: FolioSide;
};

export type Folio = {
  content: string;
  volume: number;
  folio: number;
  side: FolioSide;
};

export const folioFromDTO = (dto: FolioDTO): Folio => {
  return {
    content: dto.content,
    volume: dto.volume_number,
    folio: dto.folio_number,
    side: dto.side,
  };
};
