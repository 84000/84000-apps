import {
  Project,
  ProjectContributors as Contributors,
  getProjectContributors,
} from '@data-access';
import {
  Button,
  Skeleton,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@design-system';
import { ArrowRightIcon } from 'lucide-react';
import { Placeholder } from './ProjectPage';
import { camelCaseToHuman } from '@lib-utils';
import { useEffect, useState } from 'react';
import { useSession } from '../../app/context/SessionContext';

export const ProjectContributors = ({
  project,
}: {
  project: Project | null;
}) => {
  const { apiClient: client } = useSession();
  const [contributors, setContributors] = useState<Contributors>([]);

  useEffect(() => {
    if (!project || !client) {
      return;
    }
    const fetchContributors = async () => {
      const contributors = await getProjectContributors({
        client,
        projectUuid: project.uuid,
      });
      setContributors(contributors);
    };

    fetchContributors();
  }, [project, client]);

  return (
    <div className="lg:w-1/2 w-full flex flex-col px-4 lg:pb-0 pb-8">
      <div className="pb-4 flex flex-row justify-between">
        <span className="text-xl font-semibold">Contributors</span>
        <Button
          variant="outline"
          className="rounded-full"
          disabled={!contributors.length}
        >
          Add Contributor
        </Button>
      </div>
      {contributors.length ? (
        <div className="overflow-hidden rounded-lg border overflow-y-scroll">
          <Table>
            <TableHeader className="sticky top-0 border-b">
              <TableRow className="hover:bg-transparent">
                <TableHead>Name</TableHead>
                <TableHead>Start Date</TableHead>
                <TableHead>End Date</TableHead>
                <TableHead className="w-16">{''}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {contributors.map((contributor) => (
                <TableRow key={contributor.uuid}>
                  <TableCell>
                    <div className="flex flex-col gap-2">
                      <div className="font-semibold">{contributor.name}</div>
                      <div className="text-muted-foreground">
                        {camelCaseToHuman(contributor.role)}
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    {contributor.startDate?.toLocaleDateString() || (
                      <Placeholder />
                    )}
                  </TableCell>
                  <TableCell>
                    {contributor.endDate?.toLocaleDateString() || (
                      <Placeholder />
                    )}
                  </TableCell>
                  <TableCell className="w-16">
                    <span className="flex flex-row gap-2 text-ochre">
                      Edit
                      <ArrowRightIcon className="size-4 mt-0.5" />
                    </span>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      ) : (
        <Skeleton className="w-full h-full" />
      )}
    </div>
  );
};
