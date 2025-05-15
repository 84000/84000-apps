import { createBrowserClient, getProjects } from '@data-access';
import { H2 } from '@design-system';
import { ProjectsTable } from '../../../components/project/ProjectsTable';
import React from 'react';

export const revalidate = 60;

const page = async () => {
  const client = createBrowserClient();
  const { projects } = await getProjects({ client });

  return (
    <div className="flex flex-row justify-center pt-0 pb-8 px-4 w-full">
      <div className="w-full max-w-[1466px]">
        <H2>{'Translation Projects'}</H2>
        <ProjectsTable projects={projects} />
      </div>
    </div>
  );
};

export default page;
