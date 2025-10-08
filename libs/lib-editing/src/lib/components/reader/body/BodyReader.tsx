'use client';

import { TranslationEditor, TranslationEditorContent } from '../../editor';
import { useReaderCache } from '../ReaderCache';

export const BodyReader = ({
  content,
}: {
  content: TranslationEditorContent;
}) => {
  const { fetchEndNote, fetchGlossaryTerm } = useReaderCache();

  return (
    <TranslationEditor
      content={content}
      isEditable={false}
      fetchEndNote={fetchEndNote}
      fetchGlossaryInstance={fetchGlossaryTerm}
    />
  );
};
