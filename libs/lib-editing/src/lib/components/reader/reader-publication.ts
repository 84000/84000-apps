import { getTranslationMetadataByUuid } from '@eightyfourthousand/client-graphql/ssr';
import { isPublishedStatus } from '@eightyfourthousand/data-access';
import type { GraphQLClient } from 'graphql-request';

/**
 * Whether the stack reader may serve a work: it is published. False when its
 * metadata cannot be read, so a failed read serves nothing.
 */
export const isReaderPublished = async ({
  client,
  uuid,
}: {
  client: GraphQLClient;
  uuid: string;
}): Promise<boolean> => {
  const work = await getTranslationMetadataByUuid({ client, uuid });
  return !!work && isPublishedStatus(work.publicationStatus);
};
