import { Project } from '@data-access';
import { Skeleton } from '@design-system';

export const ProjectNotes = ({ project }: { project: Project | null }) => {
  return (
    <div className="flex flex-col gap-2">
      <span className="text-md font-semibold">Notes</span>
      {project ? (
        <>
          <div className="bg-muted/50 border rounded-lg p-4 text-sm/7 h-[250px] overflow-y-scroll">
            {project.notes}
          </div>
        </>
      ) : (
        <>
          <Skeleton className="w-full h-[250px]" />
        </>
      )}
    </div>
  );
};
