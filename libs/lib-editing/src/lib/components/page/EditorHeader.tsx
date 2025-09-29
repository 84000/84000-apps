import { SaveButton } from '@design-system';
import { useEditorState } from './EditorProvider';
import { useEffect, useState } from 'react';

export const EditorHeader = () => {
  const { dirtyUuids, save } = useEditorState();
  const [canSave, setCanSave] = useState(false);

  useEffect(() => {
    setCanSave(dirtyUuids.length > 0);
  }, [dirtyUuids]);

  return (
    <div className="sticky top-0 px-4 flex justify-end h-10">
      {canSave && (
        <SaveButton
          size="xs"
          className="my-auto"
          onClick={save}
          disabled={!dirtyUuids.length}
        />
      )}
    </div>
  );
};
