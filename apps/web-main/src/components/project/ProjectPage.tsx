'use client';

import { Project, UserRole, getProjectByUuid } from '@data-access';
import { Button, H3, Skeleton } from '@design-system';
import { ArrowLeftIcon, Settings } from 'lucide-react';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { useSession } from '../../app/context/SessionContext';
import { ProjectStages } from './ProjectStages';
import { ProjectNotes } from './ProjectNotes';
import { ProjectContributors } from './ProjectContributors';
import { ProjectAssets } from './ProjectAssets';
import { parseToh } from '@lib-utils';
import { ProjectSettings } from './ProjectInfo';

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

  const { apiClient: client, getUser } = useSession();
  const [project, setProject] = useState<Project | null>(null);
  const [role, setRole] = useState<UserRole>('reader');

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

  useEffect(() => {
    (async () => {
      const user = await getUser();
      if (user?.role) {
        setRole(user.role);
      }
    })();
  });

  return (
    <div className="w-full">
      <div className="py-6">
        <Button
          className="pl-0 text-brick hover:bg-transparent hover:cursor-pointer"
          variant="ghost"
          onClick={() => router.push(backPath)}
        >
          <ArrowLeftIcon />
          Back to Projects
        </Button>
      </div>
      <div>
        {project ? (
          <H3 className="flex flex-row mt-0 font-semibold">
            <span className="capitalize text-gray-400">
              {parseToh(project.toh)}
            </span>
            <div className="flex flex-col justify-center">
              <span className="px-4 text-brick text-2xl">-</span>
            </div>
            <span className="truncate">{project.title}</span>
            <span className="flex-1 " />
            <ProjectSettings project={project} />
          </H3>
        ) : (
          <Skeleton className="w-2/3 h-14 my-2" />
        )}
      </div>
      <div className="pt-6 pb-4 lg:flex flex-row gap-8">
        <ProjectStages project={project} />
        <div className="basis-1/2">
          <ProjectNotes project={project} role={role} />
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
