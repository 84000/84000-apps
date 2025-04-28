import {
  createBrowserClient,
  getProjectAssets,
  getProjectByUuid,
  getProjectContributors,
  getProjectStages,
} from '@data-access';
import { H2 } from '@design-system';
import React from 'react';

export const revalidate = 60;
export const dynamicParams = true;

const page = async ({ params }: { params: Promise<{ slug: string }> }) => {
  const { slug } = await params;
  const client = createBrowserClient();
  const data = await getProjectByUuid({ client, uuid: slug });
  const stages = await getProjectStages({ client, uuid: slug });
  const assets = await getProjectAssets({ client, projectUuid: slug });
  const contributors = await getProjectContributors({
    client,
    projectUuid: slug,
  });

  return (
    <div className="flex flex-row justify-center pt-0 pb-8 px-4 w-full">
      <div className="w-full">
        <H2>{'Translation Projects'}</H2>
        <pre>{JSON.stringify(data, null, 2)}</pre>
        <pre>{JSON.stringify(stages, null, 2)}</pre>
        <pre>{JSON.stringify(assets, null, 2)}</pre>
        <pre>{JSON.stringify(contributors, null, 2)}</pre>
      </div>
    </div>
  );
};

export default page;
