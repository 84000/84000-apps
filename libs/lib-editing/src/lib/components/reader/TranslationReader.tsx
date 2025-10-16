'use client';

import { TranslationEditor } from '../editor';
import { TranslationRenderer, useNavigation } from '../shared';

export const TranslationReader = ({
  content,
  className,
}: TranslationRenderer) => {
  const { fetchEndNote, fetchGlossaryTerm } = useNavigation();

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
