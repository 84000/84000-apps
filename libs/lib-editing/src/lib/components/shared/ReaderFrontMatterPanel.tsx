'use client';

import { FrontMatterPanel } from './FrontMatterPanel';
import { TranslationEditorContent } from '../editor';
import { TranslationReader } from '../reader';

export const ReaderFrontMatterPanel = ({
  summary,
}: {
  summary: TranslationEditorContent;
}) => {
  return (
    <FrontMatterPanel
      summary={summary}
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
