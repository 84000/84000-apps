'use client';

import { TranslationEditor } from '../editor';
import { PaginationProvider } from '../editor/PaginationProvider';
import { TranslationRenderer, useNavigation } from '../shared';

export const TranslationReader = ({
  content,
  className,
  filter,
  panel,
}: TranslationRenderer) => {
  const { uuid } = useNavigation();

  return (
    <PaginationProvider
      uuid={uuid}
      panel={panel}
      filter={filter}
      content={content}
      isEditable={false}
    >
      <TranslationEditor className={className} />
    </PaginationProvider>
  );
};
