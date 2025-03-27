export type GlossaryItem = {
  authorityUuid: string;
  definition?: string | null;
  names: GlossaryNames;
  nameUuid?: string;
};

export type Glossary = GlossaryItem[];

export type GlossaryName = {
  content: string;
  definition?: string | null;
  nameUuid: string;
};

export type GlossaryNames = GlossaryName[];

export type GlossaryItemDTO = {
  authority_uuid: string;
  definition?: string | null;
  names: GlossaryNamesDTO;
  name_uuid: string;
};

export type GlossaryDTO = GlossaryItemDTO[];

export type GlossaryNameDTO = {
  content: string;
  definition?: string | null;
  name_uuid: string;
};

export type GlossaryNamesDTO = GlossaryNameDTO[];

export const glossaryNameFromDTO = (dto: GlossaryNameDTO): GlossaryName => {
  return {
    content: dto.content,
    definition: dto.definition,
    nameUuid: dto.name_uuid,
  };
};

export const glossaryNamesFromDTO = (dto?: GlossaryNamesDTO): GlossaryNames => {
  return dto?.map(glossaryNameFromDTO) || [];
};

export const glossaryItemFromDTO = (dto: GlossaryItemDTO): GlossaryItem => {
  return {
    authorityUuid: dto.authority_uuid,
    definition: dto.definition,
    names: glossaryNamesFromDTO(dto.names),
    nameUuid: dto.name_uuid,
  };
};
export const glossaryFromDTO = (dto?: GlossaryDTO): Glossary => {
  return dto?.map(glossaryItemFromDTO) || [];
};
