import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
  SaveButton,
} from '@design-system';
import { useEditorState } from './EditorProvider';
import { useEffect, useState } from 'react';
import { EDITOR_KEY_TO_TITLE } from './types';
import { parseToh } from '@lib-utils';

export const EditorHeader = () => {
  const [toh, setToh] = useState<string>('...');
  const [canSave, setCanSave] = useState(false);
  const { dirtyUuids, work, builder, save } = useEditorState();

  useEffect(() => {
    setCanSave(dirtyUuids.length > 0);
  }, [dirtyUuids]);

  useEffect(() => {
    if (work.toh.length === 0) {
      setToh('...');
    }

    const parsed = work.toh.map(parseToh).join(', ');
    setToh(parsed);
  }, [work.toh]);

  return (
    <div className="sticky top-0 px-4 flex justify-between h-12 bg-background z-10">
      <Breadcrumb className="my-auto">
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbPage>{toh}</BreadcrumbPage>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbPage>{work.title}</BreadcrumbPage>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem className="capitalize">
            {EDITOR_KEY_TO_TITLE[builder] || builder}
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>
      {canSave && (
        <SaveButton size="xs" onClick={save} disabled={!dirtyUuids.length} />
      )}
    </div>
  );
};
