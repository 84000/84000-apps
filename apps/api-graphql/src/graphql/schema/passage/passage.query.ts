import type { GraphQLContext } from '../../context';

export const passageQueries = {
  passage: async (
    _parent: unknown,
    args: { uuid?: string; xmlId?: string },
    ctx: GraphQLContext,
  ) => {
    if (!args.uuid && !args.xmlId) {
      return null;
    }

    let query = ctx.supabase
      .from('passages')
      .select('uuid, content, label, sort, type, xmlId, toh, work_uuid');

    if (args.uuid) {
      query = query.eq('uuid', args.uuid);
    } else if (args.xmlId) {
      query = query.eq('xmlId', args.xmlId);
    }

    const { data, error } = await query.single();

    if (error) {
      console.error(
        `Error fetching passage ${args.uuid || args.xmlId}:`,
        error,
      );
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
