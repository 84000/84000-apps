'use client';

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
    <div className="px-4 py-3 flex justify-end h-12 z-10 gap-2">
      {canSave && (
        <SaveButton size="xs" onClick={save} disabled={!dirtyUuids.length} />
      )}
    </div>
  );
};
