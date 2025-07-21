import { Project, UserRole } from '@data-access';
import {
  Button,
  DatePicker,
  Dialog,
  DialogClose,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  SaveButton,
  Skeleton,
} from '@design-system';
import { SettingsIcon } from 'lucide-react';
import { Placeholder } from './ProjectPage';
import { ReactNode } from 'react';

const DetailInput = ({
  value,
  canEdit,
  children,
}: {
  value?: string | null;
  canEdit?: boolean;
  children?: ReactNode;
}) => {
  return <>{canEdit ? children : <span>{value || <Placeholder />}</span>}</>;
};

const DetailOrSkeleton = ({
  parent,
  label,
  children,
}: {
  parent?: unknown;
  label: string;
  children: ReactNode;
}) => {
  return (
    <div className="flex flex-col w-full gap-2">
      <span className="font-semibold">{label}</span>
      {parent ? (
        children
      ) : (
        <>
          <Skeleton className="w-1/2 h-6" />
        </>
      )}
    </div>
  );
};

export const ProjectSettings = ({
  project,
  role,
}: {
  project: Project | null;
  role: UserRole;
}) => {
  const canEdit = role === 'admin';
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
        <div className="py-4 flex flex-row gap-8">
          <DetailOrSkeleton parent={project} label="Grant Agreement Number">
            <DetailInput value={project?.contractId} canEdit={canEdit}>
              <input
                type="text"
                value={project?.contractId || ''}
                onChange={(e) => console.log(e)}
                className="border rounded p-2"
                placeholder="<none>"
              />
            </DetailInput>
          </DetailOrSkeleton>
          <DetailOrSkeleton parent={project} label="Grant Agreement Date">
            <DetailInput
              value={project?.contractDate?.toLocaleDateString()}
              canEdit={canEdit}
            >
              <DatePicker
                className="w-full"
                date={project?.contractDate}
                onSelect={(date) => {
                  console.log(date);
                }}
              />
            </DetailInput>
          </DetailOrSkeleton>
        </div>
        <DialogFooter>
          <SaveButton onClick={async () => console.log('save')} />
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
