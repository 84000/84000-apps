'use client';

import { Project, getProjects } from '@data-access';
import { H2, Skeleton } from '@design-system';
import { ProjectsTable } from './ProjectsTable';
import { useSession } from '../../app/context/SessionContext';
import { useEffect, useState } from 'react';

export const ProjectsPage = () => {
  const { apiClient: client } = useSession();
  const [projects, setProjects] = useState<Project[]>([]);

  useEffect(() => {
    if (!client) {
      return;
    }
    const fetchProjects = async () => {
      const { projects } = await getProjects({ client });
      setProjects(projects);
    };

    fetchProjects();
  }, [client]);

  return (
    <div className="flex flex-row justify-center pt-0 pb-8 px-4 w-full">
      <div className="w-full max-w-[1466px]">
        <H2>{'Translation Projects'}</H2>
        {projects.length ? (
          <ProjectsTable projects={projects} />
        ) : (
          <>
            <Skeleton className="w-full h-12" />
            <Skeleton className="w-full h-12 mt-12" />
            <Skeleton className="w-full h-[500px] mt-6" />
          </>
        )}
      </div>
    </div>
  );
};
