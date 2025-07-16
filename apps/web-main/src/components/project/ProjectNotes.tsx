import { Project, UserRole } from '@data-access';
import { Button, Skeleton } from '@design-system';
import { NotesEditor } from './NotesEditor';
import { useEffect, useState } from 'react';
import { Loader2Icon } from 'lucide-react';

const SaveButton = ({
  onClick,
  disabled = false,
}: {
  onClick: () => Promise<void>;
  disabled?: boolean;
}) => {
  const [isSaving, setIsSaving] = useState(false);
  return (
    <Button
      variant="outline"
      className="rounded-full"
      disabled={disabled || isSaving}
      onClick={async () => {
        setIsSaving(true);
        try {
          await onClick();
        } catch (error) {
          console.error('Failed to save:', error);
        } finally {
          setIsSaving(false);
        }
      }}
    >
      {isSaving ? <Loader2Icon className="animate-spin" /> : 'Save'}
    </Button>
  );
};

export const ProjectNotes = ({
  project,
  role,
}: {
  project: Project | null;
  role: UserRole;
}) => {
  const [isEditable, setIsEditable] = useState(false);
  const [notes, setNotes] = useState(project?.notes || '');
  const [nextNotes, setNextNotes] = useState<string | null>(null);
  const [isDirty, setIsDirty] = useState(false);

  useEffect(() => {
    setNotes(project?.notes || '');
  }, [project?.notes]);

  useEffect(() => {
    setIsEditable(role === 'admin');
  }, [role]);

  const saveNotes = async (notes: string) => {
    if (!project?.uuid) {
      console.error('Project UUID is required to save notes');
      return;
    }

    try {
      const res = await fetch('/api/project/notes', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          uuid: project?.uuid,
          notes,
        }),
      });
      console.dir(res, { depth: null });
      setNotes(nextNotes || '');
    } catch (error) {
      console.error('Failed to save notes:', error);
    }
  };

  return (
    <div className="flex flex-col gap-2">
      <div className="pb-4 flex flex-row justify-between">
        <span className="text-md font-semibold">Notes</span>
        {isEditable && (
          <SaveButton
            disabled={!isDirty}
            onClick={async () => {
              console.log('Saving notes...');
              // Here you would typically call an API to save the notes
              await saveNotes(nextNotes || '');
              setIsDirty(false);
            }}
          />
        )}
      </div>
      {project ? (
        <>
          <div className="bg-muted/50 border rounded-lg p-4 text-sm/7 h-[250px] overflow-y-scroll">
            <NotesEditor
              notes={notes}
              isEditable={isEditable}
              isDirty={(dirty) => {
                setIsDirty(dirty);
              }}
              onChange={(newContent) => {
                setNextNotes(newContent);
              }}
            />
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
