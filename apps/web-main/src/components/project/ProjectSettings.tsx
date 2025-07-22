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
  Input,
  SaveButton,
  Skeleton,
} from '@design-system';
import { SettingsIcon } from 'lucide-react';
import { Placeholder } from './ProjectPage';
import { ReactNode, useCallback, useEffect, useState } from 'react';

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
  onSave,
}: {
  project: Project | null;
  role: UserRole;
  onSave?: () => void;
}) => {
  const canEdit = role === 'admin';
  const [contractId, setContractId] = useState(project?.contractId || '');
  const [contractDate, setContractDate] = useState(
    project?.contractDate || null,
  );
  const [canSave, setCanSave] = useState(false);

  const saveSettings = useCallback(async () => {
    if (!contractId || !contractDate || !project?.uuid) {
      console.error('Project ID, contract ID, and contract date are required');
      return;
    }

    try {
      const res = await fetch('/api/project/settings', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          uuid: project.uuid,
          contractId: contractId,
          contractDate: contractDate?.toISOString(),
        }),
      });

      if (!res.ok) {
        throw new Error('Failed to save project settings');
      }

      console.log('Project settings saved successfully');
    } catch (error) {
      console.error('Error saving project settings:', error);
    }

    onSave?.();
  }, [project?.uuid, onSave, contractDate, contractId]);

  useEffect(() => {
    setCanSave(
      (contractId !== project?.contractId ||
        contractDate?.toISOString().split('T')[0] !==
          project?.contractDate?.toISOString().split('T')[0]) &&
        canEdit,
    );
  }, [
    contractId,
    contractDate,
    project?.contractId,
    project?.contractDate,
    canEdit,
  ]);

  useEffect(() => {
    // convert contractDate to UTC date
    const contractDate = project?.contractDate;
    if (!contractDate) {
      setContractDate(null);
      return;
    }

    const txDiff = contractDate.getTimezoneOffset() * 60000;
    const utcDate = new Date(contractDate.getTime() + txDiff);
    setContractDate(utcDate);
  }, [project?.contractDate]);

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="rounded-full [&_svg]:size-8"
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
              <Input
                type="text"
                value={contractId}
                onChange={(e) => setContractId(e.target.value)}
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
                date={contractDate || undefined}
                onSelect={(date) => {
                  setContractDate(date || null);
                }}
              />
            </DetailInput>
          </DetailOrSkeleton>
        </div>
        <DialogFooter>
          <SaveButton disabled={!canSave} onClick={saveSettings} />
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
