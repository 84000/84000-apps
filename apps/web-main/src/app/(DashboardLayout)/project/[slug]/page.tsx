import {
  createBrowserClient,
  getProjectAssets,
  getProjectByUuid,
  getProjectContributors,
  getProjectStages,
} from '@data-access';
import { ProjectPage } from '../../../../components/project/ProjectPage';
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
      <ProjectPage
        project={data}
        stages={stages}
        assets={assets}
        contributors={contributors}
      />
    </div>
  );
};

export default page;
