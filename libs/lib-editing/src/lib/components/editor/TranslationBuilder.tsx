'use client';

import type { TranslationRenderer } from '../shared/types';
import { useEffect, useState } from 'react';
import type { XmlFragment } from 'yjs';
import { useEditorState } from './EditorProvider';
import { TranslationEditor } from './TranslationEditor';
import { TranslationSkeleton, useNavigation } from '../shared';

export const TranslationBuilder = ({
  content,
  name,
  className,
}: TranslationRenderer) => {
  const [fragment, setFragment] = useState<XmlFragment>();
  const [isObserving, setIsObserving] = useState(false);
  const [isEditable, setIsEditable] = useState(false);

  const { canEdit, setEditor, startObserving, getFragment } = useEditorState();

  const { fetchEndNote } = useNavigation();

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
    <TranslationEditor
      content={content}
      className={className}
      fragment={fragment}
      isEditable={isEditable}
      fetchEndNote={fetchEndNote}
      onCreate={({ editor }) => {
        editor.commands.setDebug(true);
        setEditor(name, editor);
        if (!isObserving) {
          setIsObserving(true);
          startObserving(name);
        }
      }}
    />
  ) : (
    <TranslationSkeleton />
  );
};
