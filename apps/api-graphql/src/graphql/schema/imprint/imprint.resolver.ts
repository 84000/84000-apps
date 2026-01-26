import { getTranslationImprint } from '@data-access';
import type { GraphQLContext } from '../../context';
import type { WorkParent } from '../work/work.types';

export const imprintResolver = async (
  parent: WorkParent,
  args: { toh?: string },
  ctx: GraphQLContext,
) => {
  // Use provided toh or default to first toh in the work
  const toh = args.toh ?? parent.toh[0];

  if (!toh) {
    return null;
  }

  const imprint = await getTranslationImprint({
    client: ctx.supabase,
    uuid: parent.uuid,
    toh,
  });

  if (!imprint) {
    return null;
  }

  // Transform to GraphQL schema format
  return {
    toh: imprint.toh,
    section: imprint.section,
    version: imprint.version ?? null,
    restriction: imprint.restriction,
    publishYear: imprint.publishYear,
    tibetanAuthors: imprint.tibetanAuthors,
    isAuthorContested: imprint.isAuthorContested,
    sourceDescription: imprint.sourceDescription,
    publisherStatement: imprint.publisherStatement,
    tibetanTranslators: imprint.tibetanTranslators,
    license: {
      name: imprint.license.name ?? null,
      link: imprint.license.link ?? null,
      description: imprint.license.description ?? null,
    },
    mainTitles: imprint.mainTitles
      ? {
          tibetan: imprint.mainTitles.bo ?? null,
          english: imprint.mainTitles.en ?? null,
          wylie: imprint.mainTitles['Bo-Ltn'] ?? null,
          sanskrit: imprint.mainTitles['Sa-Ltn'] ?? null,
        }
      : null,
    longTitles: imprint.longTitles
      ? {
          tibetan: imprint.longTitles.bo ?? null,
          english: imprint.longTitles.en ?? null,
          wylie: imprint.longTitles['Bo-Ltn'] ?? null,
          sanskrit: imprint.longTitles['Sa-Ltn'] ?? null,
        }
      : null,
  };
};
