import { ExtendedTranslationLanguage } from './language';

export const TITLE_TYPES = [
  'toh',
  'mainTitle',
  'mainTitleOutsideCatalogueSection',
  'longTitle',
  'otherTitle',
  'shortcode',
] as const;

export const BO_TITLE_PREFIX = '༄༅།\u00a0\u00a0།' as const;

export type TitleType = (typeof TITLE_TYPES)[number];

/**
 * How a title's wording is attested. Absent — the overwhelming majority — means
 * the title is attested directly rather than reconstructed. Unlike `type`, these
 * are stored without an `eft:` prefix.
 */
export const TITLE_ATTESTATIONS = [
  'reconstructedPhonetic',
  'reconstructedSemantic',
] as const;

export type TitleAttestation = (typeof TITLE_ATTESTATIONS)[number];

const isTitleAttestation = (value?: string | null): boolean =>
  !!value && (TITLE_ATTESTATIONS as readonly string[]).includes(value);

export type TitleTypeDTO = `eft:${TitleType}`;

export type Title = {
  uuid: string;
  title: string;
  language: ExtendedTranslationLanguage;
  type: TitleType;
  /** Absent when the title is directly attested, which is the normal case. */
  attestation?: TitleAttestation;
};

export type Titles = Title[];

export type TitleDTO = {
  uuid: string;
  title: string;
  language: ExtendedTranslationLanguage;
  type: TitleTypeDTO;
  attestation?: string | null;
};

export type TitlesDTO = TitleDTO[];

export const titleFromDTO = (dto: TitleDTO): Title => {
  return {
    uuid: dto.uuid,
    title: dto.title,
    language: dto.language,
    type: (dto.type?.replace('eft:', '') as TitleType) || 'mainTitle',
    // Anything unrecognised is dropped rather than carried through as a value
    // the pickers cannot represent and a save would echo back.
    ...(isTitleAttestation(dto.attestation)
      ? { attestation: dto.attestation as TitleAttestation }
      : {}),
  };
};

export const titlesFromDTO = (dto?: TitlesDTO): Titles => {
  return dto?.map(titleFromDTO) || [];
};

export const titleTypeToDTO = (type: TitleType): TitleTypeDTO => `eft:${type}`;
