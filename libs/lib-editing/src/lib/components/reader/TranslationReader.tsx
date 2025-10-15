'use client';

import { TranslationEditor } from '../editor';
import { TranslationRenderer } from '../shared';
import { useReaderCache } from '../shared/EntityCache';

export const TranslationReader = ({
  content,
  className,
}: TranslationRenderer) => {
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
