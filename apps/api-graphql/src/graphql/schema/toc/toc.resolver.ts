import { getTranslationToc } from '@data-access';
import type { GraphQLContext } from '../../context';
import type { WorkParent } from '../work/work.types';

export const tocResolver = async (
  parent: WorkParent,
  _args: unknown,
  ctx: GraphQLContext,
) => {
  const toc = await getTranslationToc({
    client: ctx.supabase,
    uuid: parent.uuid,
  });

  if (!toc) {
    return null;
  }

  // Transform to GraphQL schema format
  return {
    frontMatter: toc.frontMatter,
    body: toc.body,
    backMatter: toc.backMatter,
  };
};
