import { Project } from '@data-access';
import { Button, Skeleton } from '@design-system';

const DetailOrSleleton = ({
  label,
  value,
}: {
  label: string;
  value?: string | null;
}) => {
  return (
    <div className="flex flex-col w-1/2 gap-2">
      {value ? (
        <>
          <span className="font-semibold">{label}</span>
          <span>{value}</span>
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
  return (
    <div className="bg-muted/50 border rounded-lg p-4">
      <div className="pb-4 flex flex-row justify-between">
        <span className="text-2xl font-semibold">Project Settings</span>
        <Button variant="outline" className="rounded-full" disabled={!project}>
          Edit
        </Button>
      </div>
      <div className="flex flex-row gap-8 pb-8">
        <DetailOrSleleton label="Main Translator" value={project?.translator} />
        <DetailOrSleleton
          label="Translation Group"
          value={project?.translationGroup}
        />
      </div>
      <div className="flex flex-row gap-8">
        <DetailOrSleleton
          label="Grant Agreement Number"
          value={project?.contractId}
        />
        <DetailOrSleleton
          label="Grant Agreement Date"
          value={project?.contractDate?.toLocaleDateString()}
        />
      </div>
    </div>
  );
};
