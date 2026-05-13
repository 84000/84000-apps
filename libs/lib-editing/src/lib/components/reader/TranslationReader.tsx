'use client';

import { cn } from '@eightyfourthousand/lib-utils';
import { TranslationEditor } from '../editor';
import {
  PaginationProvider,
  usePagination,
} from '../editor/PaginationProvider';
import { TranslationRenderer, useNavigation } from '../shared';
import { TranslationSSRContent } from './TranslationSSRContent';
import type { TranslationEditorContent } from '../editor';

const ReaderBody = ({
  content,
  className,
}: {
  content: TranslationEditorContent;
  className?: string;
}) => {
  const { editor } = usePagination();

  if (!editor) {
    return (
      <div className={cn('flex h-full', className)}>
        <div className="relative flex flex-col flex-1 h-full">
          <TranslationSSRContent content={content} className="flex-1" />
        </div>
      </div>
    );
  }

  return <TranslationEditor className={className} />;
};

export const TranslationReader = ({
  content,
  className,
  filter,
  panel,
  name,
}: TranslationRenderer) => {
  const { uuid } = useNavigation();

  return (
    <PaginationProvider
      uuid={uuid}
      panel={panel}
      tab={name}
      filter={filter}
      content={content}
      isEditable={false}
    >
      <ReaderBody content={content} className={className} />
    </PaginationProvider>
  );
};
