import type { GraphQLContext } from '../../context';
import type { WorkParent } from '../work/work.types';
import {
  FolioDTO,
  folioFromDTO,
  type Folio,
  type TohokuCatalogEntry,
} from '@data-access';

/**
 * Resolver for Work.folios - fetches folios for a work with pagination
 */
export const workFoliosResolver = async (
  parent: WorkParent,
  args: { toh: string; page?: number; size?: number },
  ctx: GraphQLContext,
): Promise<Folio[]> => {
  const page = args.page ?? 0;
  const size = args.size ?? 10;
  const start = page * size;
  const end = start + size - 1;

  const { data, error } = await ctx.supabase
    .from('tibetan_works_folios')
    .select(
      `
      folio_uuid,
      content::text,
      volume_number::int4,
      folio_number::int4,
      side::text`,
    )
    .eq('work_uuid', parent.uuid)
    .eq('toh', args.toh as TohokuCatalogEntry)
    .order('folio_number', { ascending: true })
    .order('side', { ascending: true })
    .range(start, end);

  if (error) {
    console.error('Error fetching folios:', error);
    return [];
  }

  return data.map((dto) => folioFromDTO(dto as FolioDTO));
};
