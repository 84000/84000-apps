import { Project, ProjectStageDetail, getProjectStages } from '@data-access';
import {
  Button,
  Skeleton,
  StageChip,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@design-system';
import { useSession } from '@lib-user';
import { Placeholder } from '../ui/Placeholder';
import { MoreHorizontalIcon } from 'lucide-react';
import { useEffect, useState } from 'react';

export const ProjectStages = ({ project }: { project?: Project | null }) => {
  const { apiClient: client } = useSession();
  const [stages, setStages] = useState<ProjectStageDetail[]>([]);

  useEffect(() => {
    if (!project || !client) {
      return;
    }
    const fetchStages = async () => {
      const stages = await getProjectStages({
        client,
        uuid: project.uuid,
      });

      stages.sort((a, b) => b.stage.date.getTime() - a.stage.date.getTime());
      setStages(stages);
    };

    fetchStages();
  }, [project, client]);
  return (
    <div className="basis-1/2 lg:h-[600px] flex flex-col pb-8">
      <div className="pb-4 flex flex-row justify-between">
        <span className="text-xl my-auto font-semibold">Stages</span>
        <Button
          variant="outline"
          className="rounded-full"
          disabled={!stages.length}
        >
          Set Next Stage
        </Button>
      </div>
      {stages.length ? (
        <div className="overflow-hidden rounded-2xl shadow-md border overflow-y-scroll">
          <Table>
            <TableHeader className="sticky top-0 border-b">
              <TableRow className="hover:bg-transparent">
                <TableHead>Stage</TableHead>
                <TableHead>Date</TableHead>
                <TableHead>Target</TableHead>
                <TableHead className="w-16">{''}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {stages.map((stage) => (
                <TableRow key={stage.uuid}>
                  <TableCell>
                    <StageChip stage={stage.stage.label} />
                  </TableCell>
                  <TableCell>{stage.stage.date.toLocaleDateString()}</TableCell>
                  <TableCell>
                    {stage.stage.targetDate?.toLocaleDateString() || (
                      <Placeholder />
                    )}
                  </TableCell>
                  <TableCell className="w-16">
                    <MoreHorizontalIcon className="text-ochre" />
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
