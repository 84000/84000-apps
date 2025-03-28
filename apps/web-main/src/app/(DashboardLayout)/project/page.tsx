import { createBrowserClient, getProjects } from '@data-access';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  H2,
  Table,
  TableBody,
  TableCaption,
  TableHead,
  TableHeader,
  TableRow,
} from '@design-system';
import React from 'react';

const page = async () => {
  const client = createBrowserClient();
  const { projects, count } = await getProjects({ client });
  console.log({ projects, count });

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle>
            <H2>{'Projects'}</H2>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableCaption>{`${count} projects`}</TableCaption>
            <TableHeader>
              <TableRow>
                <TableHead>{'Toh'}</TableHead>
                <TableHead>{'Work Title'}</TableHead>
                <TableHead>{'Translator or Group'}</TableHead>
                <TableHead>{'Stage'}</TableHead>
                <TableHead>{'Pages'}</TableHead>
                <TableHead>{'Date'}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {projects.map((project) => (
                <TableRow key={project.uuid}>
                  <TableHead>{project.toh}</TableHead>
                  <TableHead>{project.title}</TableHead>
                  <TableHead>{project.translator}</TableHead>
                  <TableHead>{project.stage}</TableHead>
                  <TableHead>{project.pages}</TableHead>
                  <TableHead>
                    {project.stageDate.toLocaleDateString()}
                  </TableHead>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </>
  );
};

export default page;
