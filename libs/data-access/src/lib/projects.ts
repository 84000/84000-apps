import { DataClient } from './types';
import { ProjectDTO, projectFromDTO } from './types/project';

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

  const dtos = (data as ProjectDTO[]) || [];
  const projects = dtos.map(projectFromDTO);

  return { projects };
};
