import type { GraphQLContext } from '../../context';
import type { WorkParent } from './work.types';
import { getWorkTitles } from '@eightyfourthousand/data-access';

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
  const titles = await getWorkTitles({ client: ctx.supabase, uuid: parent.uuid });
  return titles.map((title) => ({
    uuid: title.uuid,
    content: title.title,
    language: title.language,
    type: title.type,
  }));
};
