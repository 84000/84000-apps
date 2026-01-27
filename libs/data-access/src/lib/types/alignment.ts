import { TohokuCatalogEntry } from './toh';

export type AlignmentDTO = {
  passage_uuid: string;
  folio_uuid: string;
  toh: TohokuCatalogEntry;
  tibetan: string;
  folio_number: number;
  volume_number: number;
};

export type Alignment = {
  folioUuid: string;
  toh: TohokuCatalogEntry;
  tibetan: string;
  folioNumber: number;
  volumeNumber: number;
};

export const alignmentFromDTO = (dto: AlignmentDTO): Alignment => {
  return {
    folioUuid: dto.folio_uuid,
    toh: dto.toh,
    tibetan: dto.tibetan,
    folioNumber: dto.folio_number,
    volumeNumber: dto.volume_number,
  };
};

export const alignmentsFromDTO = (dtos: AlignmentDTO[]): Alignment[] => {
  return dtos.map(alignmentFromDTO);
};
