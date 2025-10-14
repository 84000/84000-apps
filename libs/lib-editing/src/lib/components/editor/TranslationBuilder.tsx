'use client';

import type { TranslationRenderer } from '../shared/types';
import { useEffect, useState } from 'react';
import type { XmlFragment } from 'yjs';
import { useEditorState } from '../shared/EditorProvider';
import { TranslationEditor } from '.';
import { TranslationSkeleton } from '../shared/TranslationSkeleton';
import { useReaderCache } from '../shared/EntityCache';

export const TranslationBuilder = ({
  content,
  name,
  className,
}: TranslationRenderer) => {
  const [fragment, setFragment] = useState<XmlFragment>();
  const [isObserving, setIsObserving] = useState(false);
  const [isEditable, setIsEditable] = useState(false);

  const { canEdit, setEditor, startObserving, getFragment } = useEditorState();

  const { fetchEndNote, fetchGlossaryTerm } = useReaderCache();

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
      fetchGlossaryInstance={fetchGlossaryTerm}
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
