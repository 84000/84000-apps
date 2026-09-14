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

/**
 * A stored alignment together with the passage it belongs to.
 *
 * `Alignment` is shaped for the passage-embedded case, where the owning passage
 * is the object carrying it. A work-scoped read has no such parent, so it names
 * the passage itself. `english` is present only when the caller asked for it —
 * the point of reading alignments on their own is usually to avoid paying for
 * translation content a second time.
 */
export type PassageAlignment = Alignment & {
  passageUuid: string;
  label: string;
  english?: string;
};

export type PassageAlignmentDTO = AlignmentDTO & {
  label: string;
  english?: string;
};

/**
 * A page of a work's alignments, in passage reading order.
 *
 * `passagesScanned` is the number of passages the page covered, which is not
 * the number of alignments returned: front matter and any other unaligned
 * passage contributes nothing. `hasMore` therefore has to be reported rather
 * than inferred from a short page — a page can legitimately come back empty
 * with the whole body still ahead of it.
 *
 * `nextCursor` is a passage UUID, and is the last passage scanned rather than
 * the last one that yielded an alignment, so resuming from it does not repeat
 * the unaligned tail of a page.
 */
export type PassageAlignmentsPage = {
  alignments: PassageAlignment[];
  passagesScanned: number;
  hasMore: boolean;
  nextCursor?: string;
};

export const passageAlignmentFromDTO = (
  dto: PassageAlignmentDTO,
): PassageAlignment => {
  const alignment: PassageAlignment = {
    ...alignmentFromDTO(dto),
    passageUuid: dto.passage_uuid,
    label: dto.label,
  };

  if (dto.english !== undefined) {
    alignment.english = dto.english;
  }

  return alignment;
};
