'use client';

import { TranslationEditor } from '../editor';
import { PaginationProvider } from '../editor/PaginationProvider';
import { TranslationRenderer, useNavigation } from '../shared';

export const TranslationReader = ({
  content,
  className,
  filter,
  panel,
  tab,
}: TranslationRenderer) => {
  const { uuid } = useNavigation();

  return (
    <PaginationProvider
      uuid={uuid}
      panel={panel}
      tab={tab}
      filter={filter}
      content={content}
      isEditable={false}
    >
      <TranslationEditor className={className} />
    </PaginationProvider>
  );
};
