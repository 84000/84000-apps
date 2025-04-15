import { createBrowserClient, getProjects } from '@data-access';
import { H2 } from '@design-system';
import { ProjectsTable } from '../../../components/table/ProjectsTable';
import React from 'react';

export const revalidate = 60;

const page = async () => {
  const client = createBrowserClient();
  const { projects } = await getProjects({ client });

  return (
    <div className="flex flex-row justify-center p-4 w-full">
      <div className="sm:max-w-4/5 w-full">
        <H2>{'Projects'}</H2>
        <ProjectsTable projects={projects} />
      </div>
    </div>
  );
};

export default page;
