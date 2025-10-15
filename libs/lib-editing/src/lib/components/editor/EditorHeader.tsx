import { SaveButton } from '@design-system';
import { useEditorState } from './EditorProvider';
import { useEffect, useState } from 'react';

export const EditorHeader = () => {
  const [canSave, setCanSave] = useState(false);
  const { dirtyUuids, save } = useEditorState();

  useEffect(() => {
    setCanSave(dirtyUuids.length > 0);
  }, [dirtyUuids]);

  return (
    <div className="sticky top-0 px-4 flex justify-end h-12 bg-background z-10">
      {canSave && (
        <SaveButton size="xs" onClick={save} disabled={!dirtyUuids.length} />
      )}
    </div>
  );
};
