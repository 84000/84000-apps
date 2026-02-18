import type { GraphQLContext } from '../../context';

export const passageQueries = {
  passage: async (
    _parent: unknown,
    args: { uuid: string },
    ctx: GraphQLContext,
  ) => {
    const { data, error } = await ctx.supabase
      .from('passages')
      .select('uuid, content, label, sort, type, xmlId, toh, work_uuid')
      .eq('uuid', args.uuid)
      .single();

    if (error) {
      console.error(`Error fetching passage ${args.uuid}:`, error);
      return null;
    }

    if (!data) {
      return null;
    }

    return {
      uuid: data.uuid,
      workUuid: data.work_uuid,
      content: data.content,
      label: data.label,
      sort: data.sort,
      type: data.type,
      toh: data.toh ?? null,
      xmlId: data.xmlId ?? null,
    };
  },
};
