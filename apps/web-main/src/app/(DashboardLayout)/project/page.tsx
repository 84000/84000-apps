import { createBrowserClient, getProjects } from '@data-access';
import { H2 } from '@design-system';
import { ProjectsTable } from '../../../components/ui/ProjectsTable';
import React from 'react';

const page = async () => {
  const client = createBrowserClient();
  const { projects } = await getProjects({ client });

  return (
    <div className="w-full">
      <H2>{'Projects'}</H2>
      <ProjectsTable projects={projects} />
    </div>
  );
};

export default page;
