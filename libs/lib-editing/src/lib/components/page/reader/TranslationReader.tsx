'use client';

import { PassagesEditor } from '../../editor';
import { useReader } from '../ReaderProvider';

export const TranslationReader = () => {
  const { body, fetchEndNote, fetchGlossaryTerm } = useReader();

  return (
    <PassagesEditor
      passages={body}
      isEditable={false}
      fetchEndNote={fetchEndNote}
      fetchGlossaryInstance={fetchGlossaryTerm}
    />
  );
};
