import { TranslationsTable } from '@eightyfourthousand/lib-editing';
import { H2 } from '@eightyfourthousand/design-system';
import { isPublishedStatus } from '@eightyfourthousand/data-access';
import {
  createBuildGraphQLClient,
  getTranslationsMetadata,
} from '@eightyfourthousand/client-graphql/ssr';
import React, { Suspense } from 'react';

// Rendered per request rather than prerendered: a build needs no GraphQL API,
// and without one the read fails when the page is visited, not in the build.
export const dynamic = 'force-dynamic';

const page = async () => {
  const client = createBuildGraphQLClient();
  const works = (await getTranslationsMetadata({ client, limit: 1000 })).filter(
    (work) => isPublishedStatus(work.publicationStatus),
  );

  return (
    <div className="flex flex-row justify-center pt-8 pb-8 px-4 w-full bg-surface">
      <div className="w-full max-w-feed">
        <H2 className="text-primary">{'The Reading Room'}</H2>
        <Suspense>
          <TranslationsTable works={works} />
        </Suspense>
      </div>
    </div>
  );
};

export default page;
