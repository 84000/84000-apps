import type { GraphQLContext } from '../../context';
import type { WorkParent } from './work.types';
import type { TitleDTO } from '@data-access';

type TitleResult = {
  uuid: string;
  content: string;
  language: string;
  type: string;
};

export const titlesResolver = async (
  parent: WorkParent,
  _args: Record<string, never>,
  ctx: GraphQLContext,
): Promise<TitleResult[]> => {
  const { data, error } = await ctx.supabase.rpc('get_work_titles', {
    work_uuid_input: parent.uuid,
  });

  if (error) {
    console.error('Error fetching work titles:', error);
    return [];
  }

  const titles = (data ?? []) as TitleDTO[];

  return titles.map((title) => ({
    uuid: title.uuid,
    content: title.title,
    language: title.language,
    // Remove the 'eft:' prefix from the type
    type: title.type?.replace('eft:', '') || 'mainTitle',
  }));
};
