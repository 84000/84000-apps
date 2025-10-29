export type BibliographySearchMatchDTO = {
  bibliography_uuid: string;
  content: string;
};

export type GlossarySearchMatchDTO = {
  glossary_uuid: string;
  content: string;
};

export type PassageSearchMatchDTO = {
  passage_uuid: string;
  type: string;
  label: string;
  content: string;
};

export type AlignmentSearchMatchDTO = {
  passage_uuid: string;
  english_label: string;
  english: string;
  tibetan: string;
  tibetan_volume_number: string;
  tibetan_folio_number: string;
};

export type SearchMatch = {
  type: string;
  uuid: string;
  content: string;
};

export type PassageMatch = SearchMatch & {
  type: 'passage';
  section: string;
  label: string;
};

export type AlignmentMatch = SearchMatch & {
  type: 'alignment';
  label: string;
  source: string;
  volume: string;
  folio: string;
};

export type BibliographyMatch = SearchMatch & {
  type: 'bibliography';
};

export type GlossaryMatch = SearchMatch & {
  type: 'glossary';
};

export type SearchResultsDTO = {
  passage_matches: PassageSearchMatchDTO[];
  alignment_matches: AlignmentSearchMatchDTO[];
  bibliography_matches: BibliographySearchMatchDTO[];
  glossary_matches: GlossarySearchMatchDTO[];
};

export type SearchResult =
  | SearchMatch
  | PassageMatch
  | AlignmentMatch
  | BibliographyMatch
  | GlossaryMatch;

export type SearchResults = {
  passages: PassageMatch[];
  alignments: AlignmentMatch[];
  bibliographies: SearchMatch[];
  glossaries: SearchMatch[];
};

export const bibliographyMatchFromDTO = (
  dto: BibliographySearchMatchDTO,
): BibliographyMatch => {
  return {
    type: 'bibliography',
    uuid: dto.bibliography_uuid,
    content: dto.content,
  };
};

export const glossaryMatchFromDTO = (
  dto: GlossarySearchMatchDTO,
): GlossaryMatch => {
  return {
    type: 'glossary',
    uuid: dto.glossary_uuid,
    content: dto.content,
  };
};

export const passageMatchFromDTO = (
  dto: PassageSearchMatchDTO,
): PassageMatch => {
  return {
    type: 'passage',
    uuid: dto.passage_uuid,
    section: dto.type,
    label: dto.label,
    content: dto.content,
  };
};

export const alignmentMatchFromDTO = (
  dto: AlignmentSearchMatchDTO,
): AlignmentMatch => {
  return {
    type: 'alignment',
    uuid: dto.passage_uuid,
    label: dto.english_label,
    content: dto.english,
    source: dto.tibetan,
    volume: dto.tibetan_volume_number,
    folio: dto.tibetan_folio_number,
  };
};

export const searchResultsFromDTO = (dto: SearchResultsDTO): SearchResults => {
  return {
    passages: dto.passage_matches.map(passageMatchFromDTO),
    alignments: dto.alignment_matches.map(alignmentMatchFromDTO),
    bibliographies: dto.bibliography_matches.map(bibliographyMatchFromDTO),
    glossaries: dto.glossary_matches.map(glossaryMatchFromDTO),
  };
};
