import type { GraphQLContext } from '../../context';
import type { WorkParent } from './work.types';

/**
 * Field resolver for Work.publishedVersion.
 *
 * Null means never published, which is why this field is nullable where
 * `publicationVersion` is not: that column always carries a value, so it cannot express
 * the difference between "published at 1.0.0" and "not published".
 *
 * Resolved from the pointer rather than from a column on works, so it is the version
 * actually being served. `publicationVersion` is not written by the publish pipeline at
 * all, and diverges from this the moment a work is republished.
 */
export const publishedVersionResolver = async (
  parent: WorkParent,
  _args: unknown,
  ctx: GraphQLContext,
) => {
  if (!parent.publishedVersionUuid) {
    return null;
  }
  return ctx.loaders.publishedVersionsByUuid.load(parent.publishedVersionUuid);
};
