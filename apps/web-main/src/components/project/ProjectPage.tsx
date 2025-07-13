'use client';

import { Project, getProjectByUuid } from '@data-access';
import { Button, H2, Skeleton } from '@design-system';
import { ArrowLeftIcon } from 'lucide-react';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { useSession } from '../../app/context/SessionContext';
import { ProjectStages } from './ProjectStages';
import { ProjectNotes } from './ProjectNotes';
import { ProjectSettings } from './ProjectInfo';
import { ProjectContributors } from './ProjectContributors';
import { ProjectAssets } from './ProjectAssets';

export type ProjectPageProps = {
  uuid: string;
};

export const Placeholder = () => (
  <span className="text-muted-foreground">{'<none>'}</span>
);

export const ProjectPage = ({ uuid }: ProjectPageProps) => {
  const router = useRouter();
  const pathname = usePathname();
  const backPath = pathname.split('/').slice(0, -1).join('/');

  const { apiClient: client } = useSession();
  const [project, setProject] = useState<Project | null>(null);

  useEffect(() => {
    if (!client) {
      return;
    }
    const fetchProject = async () => {
      const data = await getProjectByUuid({ client, uuid });
      setProject(data);
    };

    fetchProject();
  }, [uuid, client]);

  return (
    <div className="w-full">
      <div className="pt-4">
        <Button
          className="pl-0 text-ochre hover:bg-transparent hover:cursor-pointer"
          variant="ghost"
          onClick={() => router.push(backPath)}
        >
          <ArrowLeftIcon />
          Back to Projects
        </Button>
      </div>
      <div>
        {project ? (
          <H2 className="flex flex-row mt-0">
            <span className="uppercase text-muted-foreground">
              {project.toh}
            </span>
            <div className="flex flex-col justify-center">
              <span className="px-4 text-ochre text-2xl">-</span>
            </div>
            <span className="truncate">{project.title}</span>
          </H2>
        ) : (
          <Skeleton className="w-2/3 h-14 my-2" />
        )}
      </div>
      <div className="pt-8 pb-4 lg:flex flex-row gap-8">
        <ProjectStages project={project} />
        <div className="lg:w-1/2 w-full flex flex-col gap-8 pb-8">
          <ProjectNotes project={project} />
          <ProjectSettings project={project} />
        </div>
      </div>
      <div>
        <div className="text-2xl font-semibold pb-6">All Stages</div>
        <div className="bg-muted/50 border rounded-lg p-2">
          <div className="py-4 lg:flex flex-row gap-2">
            <ProjectContributors project={project} />
            <ProjectAssets project={project} />
          </div>
        </div>
      </div>
    </div>
  );
};
