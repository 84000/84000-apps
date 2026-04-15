import type { GraphQLContext } from '../../context';
import type { WorkParent } from '../work/work.types';
import {
  getGlossaryInstance,
  getGlossaryInstances,
  getGlossaryTermPassagesPage,
  getWorkGlossaryTermsPage,
} from '@eightyfourthousand/data-access';

type PaginationDirection = 'FORWARD' | 'BACKWARD' | 'AROUND';

export const glossaryTermPassagesResolver = async (
  parent: { uuid: string },
  args: { first?: number; after?: string },
  ctx: GraphQLContext,
) => {
  return getGlossaryTermPassagesPage({
    client: ctx.supabase,
    uuid: parent.uuid,
    first: args.first,
    after: args.after,
  });
};

export const glossaryInstanceResolver = async (
  _parent: unknown,
  args: { uuid: string },
  ctx: GraphQLContext,
) => {
  const instance = await getGlossaryInstance({
    client: ctx.supabase,
    uuid: args.uuid,
  });

  return instance ?? null;
};

export const glossaryTermPassagesPageResolver = async (
  _parent: unknown,
  args: { uuid: string; first?: number; after?: string },
  ctx: GraphQLContext,
) => {
  return getGlossaryTermPassagesPage({
    client: ctx.supabase,
    uuid: args.uuid,
    first: args.first,
    after: args.after,
  });
};

export const workGlossaryResolver = async (
  parent: WorkParent,
  args: { withAttestations?: boolean },
  ctx: GraphQLContext,
) => {
  const instances = await getGlossaryInstances({
    client: ctx.supabase,
    uuid: parent.uuid,
    withAttestations: args.withAttestations ?? false,
  });

  return instances;
};

export const workGlossaryTermsResolver = async (
  parent: WorkParent,
  args: {
    cursor?: string;
    limit?: number;
    direction?: PaginationDirection;
    withAttestations?: boolean;
  },
  ctx: GraphQLContext,
) => {
  return getWorkGlossaryTermsPage({
    client: ctx.supabase,
    workUuid: parent.uuid,
    limit: args.limit,
    cursor: args.cursor ?? null,
    direction: args.direction ?? 'FORWARD',
    withAttestations: args.withAttestations ?? false,
  });
};
