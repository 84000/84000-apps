'use client';

import { FrontMatterPanel } from '../shared/FrontMatterPanel';
import { TranslationEditorContent } from '../editor';
import { TranslationReader } from '.';
import { Toc, Work } from '@data-access';

export const ReaderFrontMatterPanel = ({
  summary,
  toc,
  work,
}: {
  summary: TranslationEditorContent;
  toc?: Toc;
  work: Work;
}) => {
  return (
    <FrontMatterPanel
      summary={summary}
      toc={toc}
      work={work}
      renderTranslation={({ content, name, className }) => (
        <TranslationReader
          content={content}
          name={name}
          className={className}
        />
      )}
    />
  );
};
