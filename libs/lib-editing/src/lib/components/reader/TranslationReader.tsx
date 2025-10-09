'use client';

import { TranslationEditor, TranslationEditorContent } from '../editor';
import { useReaderCache } from './ReaderCache';

export const TranslationReader = ({
  content,
  className,
}: {
  content: TranslationEditorContent;
  className?: string;
}) => {
  const { fetchEndNote, fetchGlossaryTerm } = useReaderCache();

  return (
    <TranslationEditor
      content={content}
      className={className}
      isEditable={false}
      fetchEndNote={fetchEndNote}
      fetchGlossaryInstance={fetchGlossaryTerm}
    />
  );
};
