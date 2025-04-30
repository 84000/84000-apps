import {
  DataClient,
  ProjectContributor,
  ProjectContributorsDTO,
  projectContributorsFromDTO,
} from './types';
import {
  Project,
  ProjectAsset,
  ProjectStageDetail,
  ProjectStageDetailsDTO,
  ProjectTableDTO,
  ProjectViewDTO,
  projectFromTableDTO,
  projectFromViewDTO,
  projectStageDetailsFromDTO,
} from './types/project';

export const getProjects = async ({
  client,
}: {
  client: DataClient;
  page?: number;
  pageSize?: number;
  orderBy?: 'toh' | 'title' | 'translator' | 'stage' | 'stage_date' | 'pages';
  ascending?: boolean;
  minStage?: string;
}) => {
  const { data } = await client.from('materialized_projects_main').select('*');

  const dtos = (data as ProjectViewDTO[]) || [];
  const projects = dtos.map(projectFromViewDTO);

  return { projects };
};

export const getProjectByUuid = async ({
  client,
  uuid,
}: {
  client: DataClient;
  uuid: string;
}): Promise<Project> => {
  const { data } = await client
    .from('projects')
    .select(
      `
      uuid,
      notes,
      contractDate:contract_date,
      contractId:contract_id,
      ...works(
        workUuid:uuid,
        pages:source_pages,
        publicationDate,
        version:publicationVersion,
        stage:publicationStatus,
        restriction,
        title,
        toh
      )
    `,
    )
    .eq('uuid', uuid)
    .single();

  return projectFromTableDTO(data as ProjectTableDTO);
};

export const getProjectStages = async ({
  client,
  uuid,
}: {
  client: DataClient;
  uuid: string;
}): Promise<ProjectStageDetail[]> => {
  const { data } = await client
    .from('project_stages')
    .select(
      `
        uuid,
        stage,
        stageDate:stage_date,
        targetDate:target_date
    `,
    )
    .eq('project_uuid', uuid);
  return projectStageDetailsFromDTO(data as ProjectStageDetailsDTO[]);
};

export const getProjectAssets = async ({
  client,
  projectUuid,
  stageUuid,
}: {
  client: DataClient;
  projectUuid?: string;
  stageUuid?: string;
}): Promise<ProjectAsset[]> => {
  if (!projectUuid && !stageUuid) {
    console.error('One of projectUuid or stageUuid is required');
    return [];
  }

  const uuid = stageUuid ? stageUuid : projectUuid;
  const key = stageUuid ? 'stage_uuid' : 'project_uuid';

  const { data } = await client
    .from('project_assets')
    .select(
      `
      uuid,
      stageUuid:stage_uuid,
      projectUuid:project_uuid,
      note,
      url:download_url,
      filename
    `,
    )
    .eq(key, uuid);
  return data || [];
};

export const getProjectContributors = async ({
  client,
  projectUuid,
  stageUuid,
}: {
  client: DataClient;
  projectUuid?: string;
  stageUuid?: string;
}): Promise<ProjectContributor[]> => {
  if (!projectUuid && !stageUuid) {
    console.error('One of projectUuid or stageUuid is required');
    return [];
  }

  const uuid = stageUuid ? stageUuid : projectUuid;
  const key = stageUuid ? 'stage_uuid' : 'project_uuid';

  const { data } = await client
    .from('project_contributors')
    .select(
      `
      uuid,
      stageUuid:stage_uuid,
      projectUuid:project_uuid,
      ...authorities!contributor_uuid(
        contributorUuid:uuid,
        name:headword
      ),
      startDate:start_date,
      endDate:end_date,
      role:type
    `,
    )
    .eq(key, uuid);
  return projectContributorsFromDTO(data as ProjectContributorsDTO);
};
