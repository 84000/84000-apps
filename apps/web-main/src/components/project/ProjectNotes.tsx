import { Project, UserRole } from '@data-access';
import { SaveButton, Skeleton } from '@design-system';
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
    <div className="basis-1/2 lg:h-[600px] flex flex-col pb-8">
      <div className="pb-4 flex flex-row justify-between">
        <span className="text-xl my-auto font-semibold">Notes</span>
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
        <div className="bg-muted/50 border rounded-lg p-4 text-sm/7 h-full overflow-y-scroll">
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
      ) : (
        <Skeleton className="w-full h-[250px]" />
      )}
    </div>
  );
};
