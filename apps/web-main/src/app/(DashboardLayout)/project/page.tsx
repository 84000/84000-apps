import { createBrowserClient, getProjects } from '@data-access';
import { Card, CardContent, CardHeader, CardTitle, H2 } from '@design-system';
import { ProjectsTable } from '../../../components/ui/ProjectsTable';
import React from 'react';

const page = async () => {
  const client = createBrowserClient();
  const { projects } = await getProjects({ client });

  return (
    <Card>
      <CardHeader>
        <CardTitle>
          <H2>{'Projects'}</H2>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <ProjectsTable projects={projects} />
      </CardContent>
    </Card>
  );
};

export default page;
