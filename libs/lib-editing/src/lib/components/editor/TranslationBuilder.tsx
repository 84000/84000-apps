'use client';

import type { TranslationRenderer } from '../shared/types';
import { useEffect, useState } from 'react';
import type { XmlFragment } from 'yjs';
import { useEditorState } from './EditorProvider';
import { TranslationEditor } from './TranslationEditor';
import { TranslationSkeleton, useNavigation } from '../shared';
import { PaginationProvider } from './PaginationProvider';

export const TranslationBuilder = ({
  content,
  name,
  className,
  filter,
  panel,
}: TranslationRenderer) => {
  const [fragment, setFragment] = useState<XmlFragment>();
  const [isObserving, setIsObserving] = useState(false);
  const [isEditable, setIsEditable] = useState(false);

  const { canEdit, setEditor, startObserving, getFragment } = useEditorState();

  const { uuid } = useNavigation();

  useEffect(() => {
    (async () => {
      const isEditable = await canEdit();

      setIsEditable(isEditable);
      if (isEditable) {
        setFragment(getFragment(name));
      }
    })();
  }, [name, canEdit, getFragment]);

  return content && fragment ? (
    <PaginationProvider
      uuid={uuid}
      panel={panel}
      filter={filter}
      content={content}
      fragment={fragment}
      isEditable={isEditable}
      onCreate={({ editor }) => {
        editor.commands.setDebug(true);
        setEditor(name, editor);
        if (!isObserving) {
          setIsObserving(true);
          startObserving(name);
        }
      }}
    >
      <TranslationEditor className={className} />
    </PaginationProvider>
  ) : (
    <TranslationSkeleton />
  );
};
