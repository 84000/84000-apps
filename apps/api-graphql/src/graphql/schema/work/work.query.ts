import {
  getTranslationMetadataByUuid,
  getTranslationMetadataByToh,
  type TohokuCatalogEntry,
  WorkDTO,
  workFromDTO,
} from '@data-access';
import type { GraphQLContext } from '../../context';

export const workQueries = {
  works: async (
    _parent: unknown,
    args: { cursor?: string; limit?: number; filter?: { maxPages?: number } },
    ctx: GraphQLContext,
  ) => {
    const limit = Math.min(args.limit ?? 50, 200);

    // Build the query
    let query = ctx.supabase
      .from('works')
      .select(
        `
        uuid,
        title,
        description,
        tohs:work_toh!inner(toh:toh_clean),
        publicationDate,
        publicationVersion,
        pages:source_pages,
        restriction,
        breadcrumb
      `,
        { count: 'exact' },
      )
      .not('toh', 'like', 'toh00%')
      .order('title', { ascending: true })
      .limit(limit + 1); // Fetch one extra to check if there are more

    // Apply maxPages filter if provided
    if (args.filter?.maxPages) {
      query = query.lt('source_pages', args.filter.maxPages);
    }

    // Apply cursor if provided
    if (args.cursor) {
      // Get the title of the cursor work for cursor-based pagination
      const { data: cursorWork } = await ctx.supabase
        .from('works')
        .select('title')
        .eq('uuid', args.cursor)
        .single();

      if (cursorWork) {
        query = query.gt('title', cursorWork.title);
      }
    }

    const { data, error, count } = await query;

    if (error) {
      console.error('Error fetching works:', error);
      return {
        items: [],
        pageInfo: {
          nextCursor: null,
          prevCursor: null,
          hasMoreAfter: false,
          hasMoreBefore: false,
        },
        totalCount: 0,
      };
    }

    const hasMoreAfter = data.length > limit;
    const items = hasMoreAfter ? data.slice(0, limit) : data;
    const works = items.map((dto) => {
      const work = workFromDTO(dto as WorkDTO);
      return {
        ...work,
        publicationDate: work.publicationDate.toISOString(),
      };
    });

    const nextCursor = hasMoreAfter ? works[works.length - 1]?.uuid : null;
    const prevCursor = args.cursor ?? null;

    return {
      items: works,
      pageInfo: {
        nextCursor,
        prevCursor,
        hasMoreAfter,
        hasMoreBefore: !!args.cursor,
      },
      totalCount: count ?? 0,
    };
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

      // Validate toh if both uuid and toh are provided
      if (
        args.toh &&
        work &&
        !work.toh.includes(args.toh as TohokuCatalogEntry)
      ) {
        throw new Error(`Work ${args.uuid} does not contain toh ${args.toh}`);
      }
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
      selectedToh: args.toh, // Pass the selected toh to child resolvers
      publicationDate: work.publicationDate.toISOString(),
    };
  },
};
