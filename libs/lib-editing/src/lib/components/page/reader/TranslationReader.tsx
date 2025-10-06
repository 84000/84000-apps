'use client';

import { TranslationEditor } from '../../editor';
import { useReader } from '../ReaderProvider';

export const TranslationReader = () => {
  const { body, fetchEndNote, fetchGlossaryTerm } = useReader();

  return (
    <TranslationEditor
      content={body}
      isEditable={false}
      fetchEndNote={fetchEndNote}
      fetchGlossaryInstance={fetchGlossaryTerm}
    />
  );
};
