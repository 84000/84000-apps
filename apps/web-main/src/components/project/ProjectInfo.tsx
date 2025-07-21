import { Contributor, Project, getProjectContributors } from '@data-access';
import {
  Button,
  Dialog,
  DialogClose,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  Skeleton,
} from '@design-system';
import { SettingsIcon } from 'lucide-react';
import { useSession } from '../../app/context/SessionContext';
import { useEffect, useState } from 'react';
import { Placeholder } from './ProjectPage';

const DetailOrSkeleton = ({
  parent,
  label,
  value,
}: {
  parent?: unknown;
  label: string;
  value?: string | null;
}) => {
  return (
    <div className="flex flex-col w-1/2 gap-2">
      {parent ? (
        <>
          <span className="font-semibold">{label}</span>
          {value ? <span>{value}</span> : <Placeholder />}
        </>
      ) : (
        <>
          <Skeleton className="w-full h-6" />
          <Skeleton className="w-1/2 h-6" />
        </>
      )}
    </div>
  );
};

export const ProjectSettings = ({ project }: { project: Project | null }) => {
  const { apiClient: client } = useSession();
  const [translator, setTranslator] = useState<Contributor | null>(null);
  const [group, setGroup] = useState<Contributor | null>(null);

  useEffect(() => {
    if (!project || !client) {
      return;
    }
    const fetchContributors = async () => {
      const contributors = await getProjectContributors({
        client,
        projectUuid: project.uuid,
      });
      const translator = contributors.find(
        (c) => c.role === 'englishTranslator',
      );
      if (translator) {
        setTranslator(translator);
      }

      const group = contributors.find(
        (c) => c.role === 'englishTranslationTeam',
      );
      if (group) {
        setGroup(group);
      }
    };

    fetchContributors();
  }, [project, client]);
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="rounded-full [&_svg]:size-full"
        >
          <SettingsIcon className="p-1" />
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            <span className="text-2xl font-semibold">Project Settings</span>
          </DialogTitle>
        </DialogHeader>
        <div className="flex flex-row gap-8 pb-8">
          <DetailOrSkeleton
            parent={translator}
            label="Main Translator"
            value={translator?.name}
          />
          <DetailOrSkeleton
            parent={group}
            label="Translation Group"
            value={group?.name}
          />
        </div>
        <div className="flex flex-row gap-8">
          <DetailOrSkeleton
            parent={project}
            label="Grant Agreement Number"
            value={project?.contractId}
          />
          <DetailOrSkeleton
            parent={project}
            label="Grant Agreement Date"
            value={project?.contractDate?.toLocaleDateString()}
          />
        </div>
        <DialogFooter>
          <DialogClose asChild>
            <Button className="rounded-full" variant="outline">
              Close
            </Button>
          </DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
