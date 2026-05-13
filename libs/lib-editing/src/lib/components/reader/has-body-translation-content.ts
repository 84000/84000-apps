import {
  BODY_MATTER_FILTER,
  createBuildGraphQLClient,
  getTranslationBlocks,
} from '@eightyfourthousand/client-graphql/ssr';

export const hasBodyTranslationContent = async ({
  uuid,
}: {
  uuid: string;
}): Promise<boolean> => {
  const client = createBuildGraphQLClient();
  const { blocks } = await getTranslationBlocks({
    client,
    uuid,
    type: BODY_MATTER_FILTER,
    maxPassages: 1,
  });
  return blocks.length > 0;
};
