import {
  getTranslationsMetadata,
  getTranslationMetadataByUuid,
  getTranslationMetadataByToh,
} from '@data-access';
import type { GraphQLContext } from '../../context';

export const workQueries = {
  works: async (_parent: unknown, _args: unknown, ctx: GraphQLContext) => {
    const works = await getTranslationsMetadata({ client: ctx.supabase });
    return works.map((work) => ({
      ...work,
      publicationDate: work.publicationDate.toISOString(),
    }));
  },

  work: async (
    _parent: unknown,
    args: { uuid?: string; toh?: string },
    ctx: GraphQLContext,
  ) => {
    let work;
    if (args.uuid) {
      work = await getTranslationMetadataByUuid({
        client: ctx.supabase,
        uuid: args.uuid,
      });
    } else if (args.toh) {
      work = await getTranslationMetadataByToh({
        client: ctx.supabase,
        toh: args.toh,
      });
    } else {
      throw new Error('Either uuid or toh must be provided');
    }

    if (!work) return null;
    return {
      ...work,
      publicationDate: work.publicationDate.toISOString(),
    };
  },
};
