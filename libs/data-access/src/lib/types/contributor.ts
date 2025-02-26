export type ContributorRole =
  | 'englishCopyEditor'
  | 'englishFinalReviewer'
  | 'englishMarkup'
  | 'englishProjectEditor'
  | 'englishTranslationTeam'
  | 'englishTranslator';

export type Contributor = {
  name: string;
  role: string;
};

export type Contributors = Contributor[];

export type ContributorDTO = {
  name: string;
  role: ContributorRole;
};

export type ContributorsDTO = ContributorDTO[];

export const contributorFromDTO = (dto: ContributorDTO): Contributor => {
  return {
    name: dto.name,
    role: dto.role,
  };
};

export const contributorsFromDTO = (dto: ContributorsDTO): Contributors => {
  return dto.map(contributorFromDTO);
};
