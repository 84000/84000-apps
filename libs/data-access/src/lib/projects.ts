import { DataClient } from './types';
import { ProjectDTO, projectFromDTO } from './types/project';

export const getProjects = async ({
  client,
  page = 1,
  pageSize = 10,
  orderBy = 'pages',
  ascending = false,
  minStage = '2.a',
}: {
  client: DataClient;
  page?: number;
  pageSize?: number;
  orderBy?: 'toh' | 'title' | 'translator' | 'stage' | 'stage_date' | 'pages';
  ascending?: boolean;
  minStage?: string;
}) => {
  const { data, count } = await client
    .from('materialized_projects_main')
    .select('*', { count: 'exact' })
    .gte('stage', minStage)
    .order(orderBy, { ascending })
    .range((page - 1) * pageSize, page * pageSize - 1);

  const dtos = (data as ProjectDTO[]) || [];
  const projects = dtos.map(projectFromDTO);

  return { projects, count };
};
