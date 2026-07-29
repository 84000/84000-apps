import { EditorLandingTabs } from '@eightyfourthousand/lib-editing';
import {
  createBuildGraphQLClient,
  getTranslationsMetadata,
} from '@eightyfourthousand/client-graphql/ssr';
import React, { Suspense } from 'react';

export const revalidate = 60;

const page = async () => {
  const client = createBuildGraphQLClient();
  const works = await getTranslationsMetadata({ client, limit: 1000 });

  return (
    <div className="flex flex-row justify-center pt-0 pb-8 px-4 w-full bg-surface">
      <div className="w-full max-w-feed">
        <Suspense>
          <EditorLandingTabs works={works} />
        </Suspense>
      </div>
    </div>
  );
};

export default page;
