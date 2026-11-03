'use client';

import { useSyncExternalStore } from 'react';
import { Badge, SaveButton } from '@eightyfourthousand/design-system';
import { useEditorState } from './EditorProvider';

export const EditorHeader = () => {
  const { dirtyStore, save, readOnly, editPermitted } = useEditorState();

  // Subscribe to dirty state directly
  const isDirty = useSyncExternalStore(
    dirtyStore.subscribe.bind(dirtyStore),
    dirtyStore.getSnapshot.bind(dirtyStore),
    () => false,
  );

  return (
    <div className="px-4 py-3 flex justify-end h-12 z-10 gap-2 pointer-events-none [&>*]:pointer-events-auto">
      {readOnly && editPermitted !== undefined && (
        <Badge variant="outline" className="self-center">
          Read-only
        </Badge>
      )}
      {isDirty && <SaveButton size="xs" onClick={save} />}
    </div>
  );
};
