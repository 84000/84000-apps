import { TranslationsTable } from '@eightyfourthousand/lib-editing';
import { H2 } from '@eightyfourthousand/design-system';
import { createBuildGraphQLClient, getTranslationsMetadata } from '@eightyfourthousand/client-graphql/ssr';
import React from 'react';

export const revalidate = 60;

const page = async () => {
  const client = createBuildGraphQLClient();
  const works = await getTranslationsMetadata({ client, limit: 1000 });

  return (
    <div className="flex flex-row justify-center pt-0 pb-8 px-4 w-full bg-surface">
      <div className="w-full max-w-feed">
        <H2 className="text-navy-500">{'The Reading Room'}</H2>
        <TranslationsTable works={works} />
      </div>
    </div>
  );
};

export default page;
