'use client';

import { TranslationEditor } from '../editor';
import { TranslationRenderer, useNavigation } from '../shared';

export const TranslationReader = ({
  content,
  className,
}: TranslationRenderer) => {
  const { fetchEndNote } = useNavigation();

  return (
    <TranslationEditor
      content={content}
      className={className}
      isEditable={false}
      fetchEndNote={fetchEndNote}
    />
  );
};
