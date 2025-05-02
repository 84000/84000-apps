export type ContributorRole =
  | 'englishAdvisor'
  | 'englishAssociateEditor'
  | 'englishCopyEditor'
  | 'englishDharmaMaster'
  | 'englishFinalReviewer'
  | 'englishMarkup'
  | 'englishProjectEditor'
  | 'englishProjectManager'
  | 'englishProofReader'
  | 'englishReviser'
  | 'englishTranslator'
  | 'englishTranslationSponsor'
  | 'englishTranslationTeam'
  | 'tibetanTranslator';

export type Contributor = {
  name: string;
  role: ContributorRole;
};

export type ProjectContributor = Contributor & {
  uuid: string;
  contributorUuid: string;
  startDate?: Date;
  endDate?: Date;
  projectUuid: string;
  stageUuid?: string;
};

export type Contributors = Contributor[];
export type ProjectContributors = ProjectContributor[];

export type ContributorDTO = {
  name: string;
  role: ContributorRole;
};

export type ContributorsDTO = ContributorDTO[];

export type ProjectContributorDTO = {
  uuid: string;
  projectUuid: string;
  stageUuid?: string;
  contributorUuid: string;
  name: string;
  role: ContributorRole;
  startDate: string;
  endDate: string;
};

export type ProjectContributorsDTO = ProjectContributorDTO[];

export const contributorFromDTO = (dto: ContributorDTO): Contributor => {
  return {
    name: dto.name,
    role: dto.role,
  };
};

export const contributorsFromDTO = (dto?: ContributorsDTO): Contributors => {
  return dto?.map(contributorFromDTO) || [];
};

export const projectContributorFromDTO = (
  dto: ProjectContributorDTO,
): ProjectContributor => {
  return {
    uuid: dto.uuid,
    name: dto.name,
    contributorUuid: dto.contributorUuid,
    role: dto.role,
    startDate: new Date(dto.startDate),
    endDate: new Date(dto.endDate),
    projectUuid: dto.projectUuid,
    stageUuid: dto.stageUuid,
  };
};

export const projectContributorsFromDTO = (
  dto?: ProjectContributorsDTO,
): ProjectContributors => {
  return dto?.map(projectContributorFromDTO) || [];
};
