import { Project, UserRole } from '@data-access';
import { Button, Skeleton } from '@design-system';
import { NotesEditor } from './NotesEditor';
import { useEffect, useState } from 'react';

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

  return (
    <div className="flex flex-col gap-2">
      <div className="pb-4 flex flex-row justify-between">
        <span className="text-md font-semibold">Notes</span>
        {isEditable && (
          <Button
            variant="outline"
            className="rounded-full"
            disabled={!isDirty}
            onClick={() => {
              console.log('Saving notes...');
              // Here you would typically call an API to save the notes
              setIsDirty(false);
              setNotes(nextNotes || '');
            }}
          >
            Save
          </Button>
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
